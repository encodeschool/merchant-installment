from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from supabase import Client
import math

from ..core.database import get_supabase
from ..core.deps import get_current_user
from ..schemas.contract import ContractOut, ContractPage, InstallmentOut
from ..services.contract import generate_pdf

router = APIRouter()


def _next_payment_date(installments: list) -> str | None:
    upcoming = [i for i in installments if i["status"] in ("UPCOMING", "OVERDUE")]
    if not upcoming:
        return None
    upcoming.sort(key=lambda i: i["due_date"])
    return upcoming[0]["due_date"]


def _contract_to_out(contract: dict, db: Client) -> ContractOut:
    import json

    app_rows = db.table("applications").select("*").eq("id", contract["application_id"]).execute().data
    app = app_rows[0] if app_rows else None
    client = db.table("clients").select("full_name").eq("id", app["client_id"]).execute().data if app else []
    merchant = db.table("merchants").select("name").eq("id", app["merchant_id"]).execute().data if app else []
    installments = db.table("installments").select("*").eq("contract_id", contract["id"]).execute().data

    # Build itemsSummary from application_items JSON; fall back to single product_id
    items_summary = ""
    item_count = 1
    product_name = None

    if app:
        raw_items = app.get("application_items")
        if isinstance(raw_items, str):
            try:
                raw_items = json.loads(raw_items)
            except Exception:
                raw_items = None

        if raw_items and isinstance(raw_items, list) and len(raw_items) > 0:
            # Batch-fetch product names
            product_ids = list({it.get("product_id") for it in raw_items if it.get("product_id")})
            prod_rows = db.table("products").select("id,name").in_("id", product_ids).execute().data if product_ids else []
            name_map = {p["id"]: p["name"] for p in prod_rows}

            parts = []
            for it in raw_items:
                pid = it.get("product_id", "")
                name = it.get("product_name") or name_map.get(pid, pid)
                qty = it.get("quantity", 1)
                parts.append(f"{name} ×{qty}")

            items_summary = ", ".join(parts)
            item_count = len(raw_items)
            product_name = parts[0].split(" ×")[0] if parts else None
        else:
            # Legacy single-product application
            pid = app.get("product_id")
            if pid:
                prod = db.table("products").select("name").eq("id", pid).execute().data
                product_name = prod[0]["name"] if prod else ""
            items_summary = product_name or ""
            item_count = 1

    return ContractOut(
        id=contract["id"],
        applicationId=contract["application_id"],
        clientName=client[0]["full_name"] if client else "",
        merchantName=merchant[0]["name"] if merchant else "",
        productName=product_name,
        itemsSummary=items_summary,
        itemCount=item_count,
        totalAmount=contract["total_amount"],
        months=contract["months"],
        monthlyPayment=contract["monthly_payment"],
        nextPaymentDate=_next_payment_date(installments),
        paidInstallments=contract["paid_installments"],
        status=contract["status"],
        createdAt=contract["created_at"],
    )


@router.get("", response_model=ContractPage)
def list_contracts(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    start = (page - 1) * page_size
    end   = start + page_size - 1

    empty = ContractPage(items=[], total=0, page=page, page_size=page_size, total_pages=0)

    if current_user["role"] == "MERCHANT":
        merchants = db.table("merchants").select("id").eq("name", current_user["organization"]).execute().data
        if not merchants:
            return empty
        app_ids = [
            a["id"] for a in
            db.table("applications").select("id").eq("merchant_id", merchants[0]["id"]).execute().data
        ]
        if not app_ids:
            return empty
        res = (
            db.table("contracts").select("*", count="exact")
            .in_("application_id", app_ids)
            .order("created_at", desc=True)
            .range(start, end)
            .execute()
        )
    else:
        res = (
            db.table("contracts").select("*", count="exact")
            .order("created_at", desc=True)
            .range(start, end)
            .execute()
        )

    contracts = res.data or []
    total     = res.count or 0

    if not contracts:
        return ContractPage(items=[], total=total, page=page, page_size=page_size,
                            total_pages=math.ceil(total / page_size) if total else 0)

    # Batch-fetch all related data (avoids N+1)
    all_app_ids  = [c["application_id"] for c in contracts]
    contract_ids = [c["id"] for c in contracts]

    apps = {
        a["id"]: a for a in
        db.table("applications").select("id, client_id, merchant_id, product_id, application_items")
        .in_("id", all_app_ids).execute().data
    }

    client_ids   = list({a["client_id"]   for a in apps.values()})
    merchant_ids = list({a["merchant_id"] for a in apps.values()})
    # Only include non-None product_ids (multi-product apps use application_items)
    product_ids  = list({a["product_id"] for a in apps.values() if a.get("product_id")})

    clients   = {r["id"]: r for r in db.table("clients").select("id, full_name").in_("id", client_ids).execute().data}
    merchants = {r["id"]: r for r in db.table("merchants").select("id, name").in_("id", merchant_ids).execute().data}
    products  = {r["id"]: r for r in (db.table("products").select("id, name").in_("id", product_ids).execute().data if product_ids else [])}

    all_installments: dict[str, list] = {cid: [] for cid in contract_ids}
    for inst in db.table("installments").select("contract_id, due_date, status").in_("contract_id", contract_ids).execute().data:
        all_installments[inst["contract_id"]].append(inst)

    import json as _json

    items = []
    for c in contracts:
        app      = apps.get(c["application_id"], {})
        client   = clients.get(app.get("client_id", ""), {})
        merchant = merchants.get(app.get("merchant_id", ""), {})
        product  = products.get(app.get("product_id", ""), {})
        insts    = all_installments.get(c["id"], [])

        # Build itemsSummary: prefer multi-product JSON, fall back to legacy product_id
        items_summary = ""
        item_count = 1
        raw_items = app.get("application_items")
        if isinstance(raw_items, str):
            try:
                raw_items = _json.loads(raw_items)
            except Exception:
                raw_items = None
        if raw_items and isinstance(raw_items, list) and len(raw_items) > 0:
            parts = []
            for it in raw_items:
                name = it.get("product_name") or products.get(it.get("product_id", ""), {}).get("name", "")
                qty = it.get("quantity", 1)
                parts.append(f"{name} ×{qty}")
            items_summary = ", ".join(parts)
            item_count = len(raw_items)
        elif product:
            items_summary = product.get("name", "")
            item_count = 1

        items.append(ContractOut(
            id=c["id"],
            applicationId=c["application_id"],
            clientName=client.get("full_name", ""),
            merchantName=merchant.get("name", ""),
            productName=product.get("name") if product else None,
            itemsSummary=items_summary,
            itemCount=item_count,
            totalAmount=c["total_amount"],
            months=c["months"],
            monthlyPayment=c["monthly_payment"],
            nextPaymentDate=_next_payment_date(insts),
            paidInstallments=c["paid_installments"],
            status=c["status"],
            createdAt=c["created_at"],
        ))

    return ContractPage(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size),
    )


@router.get("/{contract_id}", response_model=ContractOut)
def get_contract(
    contract_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    rows = db.table("contracts").select("*").eq("id", contract_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Contract not found")
    return _contract_to_out(rows[0], db)


@router.get("/{contract_id}/schedule", response_model=list[InstallmentOut])
def get_schedule(
    contract_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    rows = db.table("contracts").select("id").eq("id", contract_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Contract not found")
    installments = (
        db.table("installments").select("*")
        .eq("contract_id", contract_id)
        .order("installment_number")
        .execute().data
    )
    return [
        InstallmentOut(
            id=i["id"],
            contractId=i["contract_id"],
            installmentNumber=i["installment_number"],
            dueDate=i["due_date"],
            amount=i["amount"],
            paidAt=i.get("paid_at"),
            status=i["status"],
        )
        for i in installments
    ]


@router.get("/{contract_id}/pdf")
def get_contract_pdf(
    contract_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    rows = db.table("contracts").select("*").eq("id", contract_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Contract not found")
    contract = rows[0]

    app_rows = db.table("applications").select("*").eq("id", contract["application_id"]).execute().data
    app = app_rows[0] if app_rows else {}

    client_rows   = db.table("clients").select("full_name, passport_number, phone").eq("id", app.get("client_id", "")).execute().data if app else []
    merchant_rows = db.table("merchants").select("name").eq("id", app.get("merchant_id", "")).execute().data if app else []
    tariff_rows   = db.table("tariffs").select("interest_rate").eq("id", app.get("tariff_id", "")).execute().data if app else []

    client   = client_rows[0]   if client_rows   else {}
    merchant = merchant_rows[0] if merchant_rows else {}
    tariff   = tariff_rows[0]   if tariff_rows   else {}

    # Build items summary (multi-product aware)
    import json as _json
    items_summary = ""
    raw_items = app.get("application_items")
    if isinstance(raw_items, str):
        try:
            raw_items = _json.loads(raw_items)
        except Exception:
            raw_items = None
    if raw_items and isinstance(raw_items, list) and len(raw_items) > 0:
        product_ids = list({it.get("product_id") for it in raw_items if it.get("product_id")})
        prod_rows = db.table("products").select("id, name").in_("id", product_ids).execute().data if product_ids else []
        name_map = {p["id"]: p["name"] for p in prod_rows}
        parts = []
        for it in raw_items:
            name = it.get("product_name") or name_map.get(it.get("product_id", ""), "")
            qty = it.get("quantity", 1)
            parts.append(f"{name} x{qty}")
        items_summary = ", ".join(parts)
    if not items_summary and app.get("product_id"):
        prod = db.table("products").select("name").eq("id", app["product_id"]).execute().data
        items_summary = prod[0]["name"] if prod else ""

    app["_client_name"]     = client.get("full_name", "")
    app["_client_passport"] = client.get("passport_number", "")
    app["_client_phone"]    = client.get("phone", "")
    app["_merchant_name"]   = merchant.get("name", "")
    app["_items_summary"]   = items_summary
    app["_interest_rate"]   = tariff.get("interest_rate", 0)
    app["_signature"]       = app.get("client_signature") or app.get("signature") or ""

    installments = (
        db.table("installments").select("*")
        .eq("contract_id", contract_id)
        .order("installment_number")
        .execute().data
    )

    pdf_bytes = generate_pdf(contract, app, installments)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=shartnoma-{contract_id}.pdf"},
    )
