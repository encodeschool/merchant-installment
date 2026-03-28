from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from supabase import Client
from io import BytesIO

from ..core.database import get_supabase
from ..core.deps import get_current_user
from ..schemas.contract import ContractOut, InstallmentOut
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


@router.get("", response_model=list[ContractOut])
def list_contracts(
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    if current_user["role"] == "MERCHANT":
        merchants = db.table("merchants").select("id").eq("name", current_user["organization"]).execute().data
        if not merchants:
            return []
        app_ids = [
            a["id"] for a in
            db.table("applications").select("id").eq("merchant_id", merchants[0]["id"]).execute().data
        ]
        if not app_ids:
            return []
        contracts = db.table("contracts").select("*").in_("application_id", app_ids).execute().data
    else:
        contracts = db.table("contracts").select("*").execute().data
    return [_contract_to_out(c, db) for c in contracts]


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
    client = db.table("clients").select("full_name").eq("id", app.get("client_id", "")).execute().data if app else []
    merchant = db.table("merchants").select("name").eq("id", app.get("merchant_id", "")).execute().data if app else []
    product = db.table("products").select("name").eq("id", app.get("product_id", "")).execute().data if app else []

    app["_client_name"] = client[0]["full_name"] if client else ""
    app["_merchant_name"] = merchant[0]["name"] if merchant else ""
    app["_product_name"] = product[0]["name"] if product else ""

    installments = (
        db.table("installments").select("*")
        .eq("contract_id", contract_id)
        .order("installment_number")
        .execute().data
    )

    pdf_bytes = generate_pdf(contract, app, installments)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=contract-{contract_id}.pdf"},
    )
