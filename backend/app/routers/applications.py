import uuid
import base64
import hashlib
import json
from datetime import datetime, timezone, date
import math
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from supabase import Client

from ..core.database import get_supabase
from ..core.deps import get_current_user, require_role
from ..schemas.application import (
    ApplicationCreate,
    ApplicationPage,
    DecisionRequest,
    ApplicationOut,
    MultiProductCreate,
    MultiProductResponse,
    ConfirmRequest,
    ConfirmResponse,
)
from ..services.scoring import (
    calculate_score,
    calculate_score_full,
    monthly_payment as calc_monthly_payment,
)
from ..services.contract import generate_payment_schedule
from ..services.audit import log_action
from ..services.fraud import check_fraud_gate

router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────────────────────


def _build_items(app: dict, db: Client) -> list[dict]:
    """Return ApplicationItem list — prefer application_items JSON, fall back to single product."""
    items: list[dict] = []

    # Try JSON-encoded multi-product items first
    raw = app.get("application_items")
    if raw:
        try:
            parsed = json.loads(raw) if isinstance(raw, str) else raw
            if parsed:
                product_ids = [i["product_id"] for i in parsed if i.get("product_id")]
                products_data = (
                    (
                        db.table("products")
                        .select("*")
                        .in_("id", product_ids)
                        .execute()
                        .data
                    )
                    if product_ids
                    else []
                )
                products_map = {p["id"]: p for p in products_data}
                for item in parsed:
                    p = products_map.get(item.get("product_id", ""))
                    if p:
                        qty = item.get("quantity", 1)
                        items.append(
                            {
                                "product_id": p["id"],
                                "product_name": p["name"],
                                "category": p.get("category", ""),
                                "price": int(p["price"]),
                                "quantity": qty,
                                "subtotal": int(p["price"]) * qty,
                            }
                        )
        except Exception:
            pass

    # Fallback: single product_id on the application row
    if not items and app.get("product_id"):
        rows = (
            db.table("products").select("*").eq("id", app["product_id"]).execute().data
        )
        if rows:
            p = rows[0]
            items.append(
                {
                    "product_id": p["id"],
                    "product_name": p["name"],
                    "category": p.get("category", ""),
                    "price": int(p["price"]),
                    "quantity": 1,
                    "subtotal": int(p["price"]),
                }
            )

    return items


def _build_score_breakdown(application_id: str, db: Client) -> dict | None:
    """Fetch latest scoring log and return ScoreBreakdownOut-compatible dict."""
    try:
        rows = (
            db.table("scoring_logs")
            .select("*")
            .eq("application_id", application_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if not rows:
            return None
        sl = rows[0]
        weights = sl.get("weights_snapshot") or {
            "w1": 0.4,
            "w2": 0.3,
            "w3": 0.2,
            "w4": 0.1,
        }
        if isinstance(weights, str):
            weights = json.loads(weights)
        return {
            "f1_affordability": sl.get("income_score", 0),
            "f2_credit": sl.get("credit_score", 0),
            "f3_behavioral": sl.get("tariff_score", 0),
            "f4_demographic": sl.get("age_score", 0),
            "weights": weights,
            "total_score": sl.get("total_score", 0),
            "decision": sl.get("outcome", "REJECTED"),
            "approved_ratio": 1.0,
            "hard_reject": bool(sl.get("hard_reject", False)),
            "hard_reject_reason": sl.get("hard_reject_reason"),
            "reason_codes": sl.get("reason_codes") or [],
        }
    except Exception:
        return None


def _app_to_out(app: dict, db: Client, include_score: bool = True) -> ApplicationOut:
    from ..schemas.application import (
        ApplicationItemOut,
        ClientDetailOut,
        ScoreBreakdownOut,
        FraudSignalOut,
        ApplicationOut as _AppOut,
    )

    # Merchant
    merchant_rows = (
        db.table("merchants").select("name").eq("id", app["merchant_id"]).execute().data
    )
    merchant_name = merchant_rows[0]["name"] if merchant_rows else ""

    # Client (fetch all fields)
    client_rows = (
        db.table("clients").select("*").eq("id", app["client_id"]).execute().data
    )
    c = client_rows[0] if client_rows else {}
    client_out = ClientDetailOut(
        full_name=c.get("full_name", ""),
        passport_number=c.get("passport_number", ""),
        phone=c.get("phone", ""),
        age=c.get("age", 0),
        monthly_income=c.get("monthly_income", 0),
        employment_type=c.get("employment_type", "EMPLOYED"),
        pinfl=c.get("pinfl"),
        open_loans=c.get("open_loans", 0),
        overdue_days=c.get("overdue_days", 0),
        has_bankruptcy=bool(c.get("has_bankruptcy", False)),
        credit_history=c.get("credit_history", "NONE"),
    )

    # Tariff
    tariff = {}
    mfo_name = ""
    if app.get("tariff_id"):
        tariff_rows = (
            db.table("tariffs")
            .select("name, mfo_user_id")
            .eq("id", app["tariff_id"])
            .execute()
            .data
        )
        if tariff_rows:
            tariff = tariff_rows[0]
            # Get MFO name from users table
            mfo_rows = (
                db.table("users")
                .select("organization")
                .eq("id", tariff["mfo_user_id"])
                .execute()
                .data
            )
            mfo_name = mfo_rows[0]["organization"] if mfo_rows else ""

    # Items
    items = _build_items(app, db)
    items_out = [ApplicationItemOut(**i) for i in items]

    # Amounts
    total_amount = int(app.get("total_amount") or 0)
    approved_amount = app.get("approved_amount")
    financed_amount = int(approved_amount or total_amount)
    down_payment_amount = max(0, total_amount - financed_amount)

    # Score breakdown (only fetched for detail view to avoid N+1 in list)
    score_breakdown_out = None
    if include_score:
        sd = _build_score_breakdown(app["id"], db)
        if sd:
            score_breakdown_out = ScoreBreakdownOut(**sd)

    return _AppOut(
        id=app["id"],
        merchant_id=app["merchant_id"],
        merchant_name=merchant_name,
        client=client_out,
        items=items_out,
        total_amount=total_amount,
        down_payment_amount=down_payment_amount,
        financed_amount=financed_amount,
        tariff_id=app.get("tariff_id"),
        tariff_name=tariff.get("name"),
        mfo_name=mfo_name,
        months=app.get("months"),
        monthly_payment=app.get("monthly_payment"),
        approved_amount=approved_amount,
        score=int(app.get("score") or 0),
        score_breakdown=score_breakdown_out,
        fraud_gate=app.get("fraud_gate", "PASS") or "PASS",
        fraud_signals=[],
        face_image_url=None,
        signature_url=None,
        status=app["status"],
        created_at=app["created_at"],
        decided_at=app.get("decided_at"),
        decided_by=app.get("decided_by"),
        override_reason=app.get("override_reason"),
    )


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def create_application(
    body: ApplicationCreate,
    request: Request,
    current_user: dict = Depends(require_role("MERCHANT")),
    db: Client = Depends(get_supabase),
):
    merchant_rows = (
        db.table("merchants").select("*").eq("id", body.merchant_id).execute().data
    )
    if not merchant_rows:
        raise HTTPException(status_code=404, detail="Merchant not found")

    product_rows = (
        db.table("products").select("*").eq("id", body.product_id).execute().data
    )
    if not product_rows:
        raise HTTPException(status_code=404, detail="Product not found")
    product = product_rows[0]
    if not product["available"]:
        raise HTTPException(status_code=400, detail="Product is not available")

    tariff_rows = (
        db.table("tariffs").select("*").eq("id", body.tariff_id).execute().data
    )
    if not tariff_rows:
        raise HTTPException(status_code=404, detail="Tariff not found")
    tariff = tariff_rows[0]
    if tariff["status"] != "APPROVED":
        raise HTTPException(status_code=400, detail="Tariff is not approved")

    if body.months not in {3, 6, 9, 12}:
        raise HTTPException(status_code=422, detail="Months must be one of 3, 6, 9, 12")
    if not (tariff["min_months"] <= body.months <= tariff["max_months"]):
        raise HTTPException(status_code=422, detail="Months out of tariff range")

    existing_client = (
        db.table("clients")
        .select("*")
        .eq("passport_number", body.client.passport_number)
        .execute()
        .data
    )
    if existing_client:
        client_id = existing_client[0]["id"]
        db.table("clients").update(
            {
                "full_name": body.client.full_name,
                "phone": body.client.phone,
                "monthly_income": body.client.monthly_income,
                "age": body.client.age,
                "credit_history": body.client.credit_history,
                "open_loans": body.client.open_loans,
                "overdue_days": body.client.overdue_days,
                "has_bankruptcy": body.client.has_bankruptcy,
            }
        ).eq("id", client_id).execute()
        client = db.table("clients").select("*").eq("id", client_id).execute().data[0]
    else:
        client_data = {
            "id": str(uuid.uuid4()),
            "full_name": body.client.full_name,
            "passport_number": body.client.passport_number,
            "phone": body.client.phone,
            "monthly_income": body.client.monthly_income,
            "age": body.client.age,
            "credit_history": body.client.credit_history,
            "open_loans": body.client.open_loans,
            "overdue_days": body.client.overdue_days,
            "has_bankruptcy": body.client.has_bankruptcy,
        }
        client = db.table("clients").insert(client_data).execute().data[0]

    down_payment = int(product["price"] * product["down_payment_percent"] / 100)
    financed_amount = product["price"] - down_payment
    mp = calc_monthly_payment(financed_amount, body.months, tariff["interest_rate"])
    total = int(mp * body.months)

    score_result = calculate_score(
        monthly_income=client["monthly_income"],
        monthly_payment=mp,
        age=client["age"],
        credit_history=client["credit_history"],
        open_loans=client["open_loans"],
        overdue_days=client["overdue_days"],
        has_bankruptcy=client["has_bankruptcy"],
        w_affordability=tariff["w_affordability"],
        w_credit=tariff["w_credit_history"],
        w_behavioral=tariff["w_behavioral"],
        w_demographic=tariff["w_demographic"],
        min_score=tariff["min_score"],
        partial_threshold=tariff["partial_threshold"],
        partial_ratio=tariff["partial_ratio"],
        hard_dti_min=tariff["hard_dti_min"],
        max_open_loans=tariff["max_open_loans"],
        max_overdue_days=tariff["max_overdue_days"],
        bankruptcy_reject=tariff["bankruptcy_reject"],
    )

    app_data = {
        "id": str(uuid.uuid4()),
        "merchant_id": body.merchant_id,
        "client_id": client["id"],
        "product_id": body.product_id,
        "tariff_id": body.tariff_id,
        "months": body.months,
        "monthly_payment": int(mp),
        "total_amount": total,
        "score": score_result["total_score"],
        "status": "PENDING",
    }
    application = db.table("applications").insert(app_data).execute().data[0]

    db.table("scoring_logs").insert(
        {
            "id": str(uuid.uuid4()),
            "application_id": application["id"],
            "client_id": client["id"],
            "income_score": score_result["f1_affordability"],
            "credit_score": score_result["f2_credit"],
            "age_score": score_result["f4_demographic"],
            "tariff_score": score_result["f3_behavioral"],
            "total_score": score_result["total_score"],
            "outcome": score_result["decision"],
            "weights_snapshot": score_result["weights"],
            "hard_reject": score_result["hard_reject"],
            "hard_reject_reason": score_result["hard_reject_reason"],
            "reason_codes": score_result["reason_codes"],
        }
    ).execute()

    log_action(
        db,
        current_user["id"],
        "CREATE",
        "application",
        application["id"],
        request.client.host if request.client else "",
    )
    return _app_to_out(application, db)


@router.get("", response_model=ApplicationPage)
def list_applications(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    from ..schemas.application import (
        ApplicationItemOut,
        ClientDetailOut,
        ApplicationOut as _AppOut,
    )

    start = (page - 1) * page_size
    end   = start + page_size - 1
    empty = ApplicationPage(items=[], total=0, page=page, page_size=page_size, total_pages=0)

    if current_user["role"] == "MERCHANT":
        merchants = (
            db.table("merchants")
            .select("id")
            .eq("name", current_user["organization"])
            .execute()
            .data
        )
        if not merchants:
            return empty
        res = (
            db.table("applications")
            .select("*", count="exact")
            .eq("merchant_id", merchants[0]["id"])
            .order("created_at", desc=True)
            .range(start, end)
            .execute()
        )
    else:
        res = (
            db.table("applications")
            .select("*", count="exact")
            .order("created_at", desc=True)
            .range(start, end)
            .execute()
        )

    apps  = res.data or []
    total = res.count or 0

    if not apps:
        return ApplicationPage(items=[], total=total, page=page, page_size=page_size,
                               total_pages=math.ceil(total / page_size) if total else 0)

    # Batch fetch merchants, clients, products, tariffs
    merchant_ids = list(set(a["merchant_id"] for a in apps if a.get("merchant_id")))
    client_ids   = list(set(a["client_id"]   for a in apps if a.get("client_id")))
    product_ids  = list(set(a["product_id"]  for a in apps if a.get("product_id")))
    tariff_ids   = list(set(a["tariff_id"]   for a in apps if a.get("tariff_id")))

    merchants_data = db.table("merchants").select("id, name").in_("id", merchant_ids).execute().data if merchant_ids else []
    clients_data   = db.table("clients").select("*").in_("id", client_ids).execute().data if client_ids else []
    products_data  = db.table("products").select("id, name, price, category").in_("id", product_ids).execute().data if product_ids else []
    tariffs_data   = db.table("tariffs").select("id, name, mfo_user_id").in_("id", tariff_ids).execute().data if tariff_ids else []

    mfo_user_ids = list(set(t["mfo_user_id"] for t in tariffs_data))
    mfo_data     = db.table("users").select("id, organization").in_("id", mfo_user_ids).execute().data if mfo_user_ids else []
    mfo_map      = {m["id"]: m["organization"] for m in mfo_data}
    for t in tariffs_data:
        t["mfo_name"] = mfo_map.get(t["mfo_user_id"], "")

    merchants_map = {m["id"]: m for m in merchants_data}
    clients_map   = {c["id"]: c for c in clients_data}
    products_map  = {p["id"]: p for p in products_data}
    tariffs_map   = {t["id"]: t for t in tariffs_data}

    result = []
    for app in apps:
        merchant = merchants_map.get(app.get("merchant_id", ""), {})
        c        = clients_map.get(app.get("client_id", ""), {})
        product  = products_map.get(app.get("product_id", ""), {})
        tariff   = tariffs_map.get(app.get("tariff_id", ""), {})

        client_out = ClientDetailOut(
            full_name=c.get("full_name", ""),
            passport_number=c.get("passport_number", ""),
            phone=c.get("phone", ""),
            age=c.get("age", 0),
            monthly_income=c.get("monthly_income", 0),
            employment_type=c.get("employment_type", "EMPLOYED"),
            pinfl=c.get("pinfl"),
            open_loans=c.get("open_loans", 0),
            overdue_days=c.get("overdue_days", 0),
            has_bankruptcy=bool(c.get("has_bankruptcy", False)),
            credit_history=c.get("credit_history", "NONE"),
        )

        items_out: list[ApplicationItemOut] = []
        raw_items = app.get("application_items")
        if raw_items:
            try:
                parsed = json.loads(raw_items) if isinstance(raw_items, str) else raw_items
                for it in parsed or []:
                    p = products_map.get(it.get("product_id", ""))
                    if p:
                        qty = it.get("quantity", 1)
                        items_out.append(ApplicationItemOut(
                            product_id=p["id"], product_name=p["name"],
                            category=p.get("category", ""), price=int(p["price"]),
                            quantity=qty, subtotal=int(p["price"]) * qty,
                        ))
            except Exception:
                pass
        if not items_out and product:
            items_out.append(ApplicationItemOut(
                product_id=product["id"], product_name=product["name"],
                category=product.get("category", ""), price=int(product["price"]),
                quantity=1, subtotal=int(product["price"]),
            ))

        total_amount        = int(app.get("total_amount") or 0)
        approved_amount     = app.get("approved_amount")
        financed_amount     = int(approved_amount or total_amount)
        down_payment_amount = max(0, total_amount - financed_amount)

        result.append(_AppOut(
            id=app["id"],
            merchant_id=app.get("merchant_id", ""),
            merchant_name=merchant.get("name", ""),
            client=client_out,
            items=items_out,
            total_amount=total_amount,
            down_payment_amount=down_payment_amount,
            financed_amount=financed_amount,
            tariff_id=app.get("tariff_id"),
            tariff_name=tariff.get("name"),
            mfo_name=tariff.get("mfo_name"),
            months=app.get("months"),
            monthly_payment=app.get("monthly_payment"),
            approved_amount=approved_amount,
            score=int(app.get("score") or 0),
            score_breakdown=None,
            fraud_gate=app.get("fraud_gate", "PASS") or "PASS",
            fraud_signals=[],
            face_image_url=None,
            signature_url=None,
            status=app["status"],
            created_at=app["created_at"],
            decided_at=app.get("decided_at"),
            decided_by=app.get("decided_by"),
            override_reason=app.get("override_reason"),
        ))

    return ApplicationPage(
        items=result,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size),
    )


@router.get("/{application_id}/detail", response_model=ApplicationOut)
def get_application_detail(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    """Full detail including score_breakdown fetched from scoring_logs."""
    rows = db.table("applications").select("*").eq("id", application_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Application not found")
    return _app_to_out(rows[0], db, include_score=True)


@router.get("/{application_id}", response_model=ApplicationOut)
def get_application(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    rows = db.table("applications").select("*").eq("id", application_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Application not found")
    return _app_to_out(rows[0], db, include_score=False)


@router.patch("/{application_id}/decide", response_model=ApplicationOut)
def decide_application(
    application_id: str,
    body: DecisionRequest,
    request: Request,
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    rows = db.table("applications").select("*").eq("id", application_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Application not found")
    app = rows[0]
    if app["status"] != "PENDING":
        raise HTTPException(
            status_code=400, detail="Application is not in PENDING status"
        )

    updates = {
        "status": body.action,
        "decided_by": current_user["id"],
        "decided_at": datetime.now(timezone.utc).isoformat(),
    }
    if body.override_reason:
        updates["override_reason"] = body.override_reason

    if body.action in ("APPROVED", "PARTIAL"):
        product_rows = (
            db.table("products").select("*").eq("id", app["product_id"]).execute().data
        )
        product = product_rows[0] if product_rows else {}
        tariff_rows = (
            db.table("tariffs").select("*").eq("id", app["tariff_id"]).execute().data
        )
        tariff = tariff_rows[0] if tariff_rows else {}

        if body.action == "PARTIAL":
            down = int(
                product.get("price", 0) * product.get("down_payment_percent", 0) / 100
            )
            financed = product.get("price", 0) - down
            approved_amount = (
                body.approved_amount if body.approved_amount else int(financed * 0.70)
            )
            mp = calc_monthly_payment(
                approved_amount, app["months"], tariff.get("interest_rate", 0)
            )
            updates["monthly_payment"] = int(mp)
            updates["total_amount"] = int(mp * app["months"])
        else:
            approved_amount = (
                body.approved_amount if body.approved_amount else app["total_amount"]
            )
        updates["approved_amount"] = approved_amount

    application = (
        db.table("applications")
        .update(updates)
        .eq("id", application_id)
        .execute()
        .data[0]
    )

    if body.action in ("APPROVED", "PARTIAL"):
        contract_data = {
            "id": str(uuid.uuid4()),
            "application_id": application["id"],
            "total_amount": application["total_amount"],
            "months": application["months"],
            "monthly_payment": application["monthly_payment"],
            "paid_installments": 0,
            "status": "ACTIVE",
        }
        contract = db.table("contracts").insert(contract_data).execute().data[0]

        schedule = generate_payment_schedule(
            contract["id"],
            datetime.now(timezone.utc).date(),
            application["monthly_payment"],
            application["months"],
        )
        db.table("installments").insert(schedule).execute()

    log_action(
        db,
        current_user["id"],
        f"DECIDE_{body.action}",
        "application",
        application_id,
        request.client.host if request.client else "",
    )
    return _app_to_out(application, db)


# ── Helpers ────────────────────────────────────────────────────────────────────

_JPEG_MAGIC = b"\xff\xd8\xff"
_PNG_MAGIC = b"\x89PNG"

_DEFAULT_WEIGHTS = dict(
    w_affordability=0.40,
    w_credit=0.30,
    w_behavioral=0.20,
    w_demographic=0.10,
    min_score=60,
    partial_threshold=45,
    partial_ratio=0.70,
    hard_dti_min=1.5,
    max_open_loans=5,
    max_overdue_days=90,
    bankruptcy_reject=True,
)


def _validate_b64_image(b64: str) -> bytes:
    try:
        data = base64.b64decode(b64)
    except Exception:
        raise HTTPException(422, "Invalid base64 image data")
    if len(data) < 1024:
        raise HTTPException(422, "Image too small — ensure camera is working")
    if not (data[:3] == _JPEG_MAGIC or data[:4] == _PNG_MAGIC):
        raise HTTPException(422, "Unsupported image format — use JPEG or PNG")
    return data


def _fake_face_verify(image_bytes: bytes, passport: str) -> dict:
    digest = hashlib.sha256(image_bytes[:512] + passport.encode()).hexdigest()
    seed = int(digest[:8], 16)
    confidence = round(0.82 + (seed % 1000) / 6666, 4)
    return {"verified": True, "confidence": confidence}


def _age_from_birth_date(birth_date_str: str) -> int:
    try:
        bd = date.fromisoformat(birth_date_str)
        today = date.today()
        return today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
    except Exception:
        return 30


def _run_scoring(
    client_data: dict, mp: float, tariff: dict | None, fraud_gate: str
) -> dict:
    """Run calculate_score_full with tariff config (or defaults). Apply fraud penalty."""
    cfg = tariff if tariff else {}

    # Use `or` fallback so explicit 0.0 values stored in DB fall back to defaults
    w1 = cfg.get("w_affordability") or _DEFAULT_WEIGHTS["w_affordability"]
    w2 = cfg.get("w_credit_history") or _DEFAULT_WEIGHTS["w_credit"]
    w3 = cfg.get("w_behavioral") or _DEFAULT_WEIGHTS["w_behavioral"]
    w4 = cfg.get("w_demographic") or _DEFAULT_WEIGHTS["w_demographic"]
    # If all weights are still zero, force defaults
    if w1 + w2 + w3 + w4 == 0:
        w1, w2, w3, w4 = (
            _DEFAULT_WEIGHTS["w_affordability"],
            _DEFAULT_WEIGHTS["w_credit"],
            _DEFAULT_WEIGHTS["w_behavioral"],
            _DEFAULT_WEIGHTS["w_demographic"],
        )

    result = calculate_score_full(
        monthly_income=client_data.get("monthly_income", 0),
        monthly_payment=mp,
        age=client_data.get("age", 30),
        credit_history=client_data.get("credit_history", "NONE"),
        open_loans=client_data.get("open_loans", 0),
        overdue_days=client_data.get("overdue_days", 0),
        has_bankruptcy=client_data.get("has_bankruptcy", False),
        w_affordability=w1,
        w_credit=w2,
        w_behavioral=w3,
        w_demographic=w4,
        min_score=cfg.get("min_score") or _DEFAULT_WEIGHTS["min_score"],
        partial_threshold=cfg.get("partial_threshold")
        or _DEFAULT_WEIGHTS["partial_threshold"],
        partial_ratio=cfg.get("partial_ratio") or _DEFAULT_WEIGHTS["partial_ratio"],
        hard_dti_min=cfg.get("hard_dti_min") or _DEFAULT_WEIGHTS["hard_dti_min"],
        max_open_loans=(
            cfg.get("max_open_loans")
            if cfg.get("max_open_loans") is not None
            else _DEFAULT_WEIGHTS["max_open_loans"]
        ),
        max_overdue_days=(
            cfg.get("max_overdue_days")
            if cfg.get("max_overdue_days") is not None
            else _DEFAULT_WEIGHTS["max_overdue_days"]
        ),
        bankruptcy_reject=(
            cfg.get("bankruptcy_reject")
            if cfg.get("bankruptcy_reject") is not None
            else _DEFAULT_WEIGHTS["bankruptcy_reject"]
        ),
    )
    if fraud_gate == "FLAG":
        result["total_score"] = max(0, result["total_score"] - 10)
    return result


# ── POST /multi-product ────────────────────────────────────────────────────────


@router.post("/multi-product", response_model=MultiProductResponse, status_code=201)
def create_multi_product_application(
    body: MultiProductCreate,
    request: Request,
    current_user: dict = Depends(require_role("MERCHANT")),
    db: Client = Depends(get_supabase),
):
    # 1. Validate merchant
    merchant_rows = (
        db.table("merchants").select("*").eq("id", body.merchant_id).execute().data
    )
    if not merchant_rows:
        raise HTTPException(404, "Merchant not found")

    # 2. Validate products & compute total_price
    products: list[dict] = []
    total_price = 0
    for item in body.items:
        rows = db.table("products").select("*").eq("id", item.product_id).execute().data
        if not rows:
            raise HTTPException(404, f"Product {item.product_id} not found")
        p = rows[0]
        if p.get("merchant_id") != body.merchant_id:
            raise HTTPException(
                400, f"Product {p['name']} does not belong to this merchant"
            )
        if not p.get("available", True):
            raise HTTPException(400, f"Product {p['name']} is not available")
        products.append({"product": p, "quantity": item.quantity})
        total_price += int(p["price"]) * item.quantity

    # 3. Face verify (inline — same logic as /face-verify router)
    face_ok = False
    if body.face_image_b64:
        try:
            img = _validate_b64_image(body.face_image_b64)
            _fake_face_verify(img, body.client.passport_number)
            face_ok = True
        except HTTPException:
            pass

    # 4. Fraud pre-gate
    fraud_gate, fraud_signals = check_fraud_gate(
        body.client.pinfl,
        body.client.passport_number,
        body.merchant_id,
    )

    # 5. Find eligible tariffs
    all_tariffs = (
        db.table("tariffs").select("*").eq("status", "APPROVED").execute().data or []
    )
    eligible_tariffs = [
        t
        for t in all_tariffs
        if t.get("min_amount", 0) <= total_price <= t.get("max_amount", 999_999_999)
    ]

    # 6. Compute age
    age = body.client.age
    if body.client.birth_date:
        age = _age_from_birth_date(body.client.birth_date)

    client_data = {
        "monthly_income": body.client.monthly_income,
        "age": age,
        "credit_history": body.client.credit_history,
        "open_loans": body.client.open_loans,
        "overdue_days": body.client.overdue_days,
        "has_bankruptcy": body.client.has_bankruptcy,
    }

    # 7. Down-payment & financed amount
    max_down_pct = max(
        (p["product"].get("down_payment_percent", 0) for p in products), default=0
    )
    down_amount = int(total_price * max_down_pct / 100)
    financed = total_price - down_amount

    # 8. Score
    if fraud_gate == "BLOCK":
        score_result = {
            "hard_reject": True,
            "hard_reject_reason": "FRAUD_BLOCK",
            "f1_affordability": 0,
            "f2_credit": 0,
            "f3_behavioral": 0,
            "f4_demographic": 0,
            "weights": {"w1": 0.4, "w2": 0.3, "w3": 0.2, "w4": 0.1},
            "total_score": 0,
            "decision": "REJECTED",
            "approved_ratio": 0.0,
            "reason_codes": fraud_signals,
        }
    else:
        first_tariff = eligible_tariffs[0] if eligible_tariffs else None
        months_for_scoring = body.months if body.months in (3, 6, 9, 12) else 12
        rate = first_tariff["interest_rate"] if first_tariff else 24.0
        mp = calc_monthly_payment(financed, months_for_scoring, rate)
        score_result = _run_scoring(client_data, mp, first_tariff, fraud_gate)

    # 9. Build eligible offers
    eligible_offers = []
    if fraud_gate != "BLOCK" and not score_result.get("hard_reject", False):
        approved_ratio = score_result.get("approved_ratio", 1.0)
        approved_amount = (
            int(financed * approved_ratio) if approved_ratio > 0 else financed
        )
        for tariff in eligible_tariffs:
            min_m = tariff.get("min_months", 3)
            max_m = tariff.get("max_months", 12)
            av_months = [m for m in [3, 6, 9, 12] if min_m <= m <= max_m] or [
                3,
                6,
                9,
                12,
            ]
            min_mp = calc_monthly_payment(
                approved_amount, max(av_months), tariff["interest_rate"]
            )
            max_mp = calc_monthly_payment(
                approved_amount, min(av_months), tariff["interest_rate"]
            )
            eligible_offers.append(
                {
                    "tariff_id": tariff["id"],
                    "mfo_name": tariff.get("mfo_name", ""),
                    "tariff_name": tariff["name"],
                    "interest_rate": tariff["interest_rate"],
                    "available_months": av_months,
                    "min_monthly_payment": round(min_mp / 1000) * 1000,
                    "max_monthly_payment": round(max_mp / 1000) * 1000,
                    "min_down_payment_pct": float(max_down_pct),
                    "approved_amount": approved_amount,
                    "approved_ratio": approved_ratio,
                }
            )

    # 10. Upsert client
    existing = (
        db.table("clients")
        .select("*")
        .eq("passport_number", body.client.passport_number)
        .execute()
        .data
    )
    client_row = {
        "full_name": body.client.full_name or f"Client {body.client.passport_number}",
        "passport_number": body.client.passport_number,
        "phone": body.client.phone or "",
        "monthly_income": body.client.monthly_income,
        "age": age,
        "credit_history": body.client.credit_history,
        "open_loans": body.client.open_loans,
        "overdue_days": body.client.overdue_days,
        "has_bankruptcy": body.client.has_bankruptcy,
    }
    if existing:
        client_id = existing[0]["id"]
        db.table("clients").update(client_row).eq("id", client_id).execute()
    else:
        client_id = str(uuid.uuid4())
        client_row["id"] = client_id
        db.table("clients").insert(client_row).execute()

    # 11. Pick tariff_id for FK (required by table schema)
    primary_tariff_id = eligible_tariffs[0]["id"] if eligible_tariffs else None
    if not primary_tariff_id:
        any_t = (
            db.table("tariffs")
            .select("id")
            .eq("status", "APPROVED")
            .limit(1)
            .execute()
            .data
        )
        if any_t:
            primary_tariff_id = any_t[0]["id"]
    if not primary_tariff_id:
        raise HTTPException(400, "No approved tariffs found in the system")

    primary_product_id = products[0]["product"]["id"]
    app_status = "REJECTED" if fraud_gate == "BLOCK" else "PENDING"
    estimated_mp = calc_monthly_payment(
        financed,
        body.months if body.months in (3, 6, 9, 12) else 12,
        eligible_tariffs[0]["interest_rate"] if eligible_tariffs else 24.0,
    )

    app_data: dict = {
        "id": str(uuid.uuid4()),
        "merchant_id": body.merchant_id,
        "client_id": client_id,
        "product_id": primary_product_id,
        "tariff_id": primary_tariff_id,
        "months": body.months if body.months in (3, 6, 9, 12) else 12,
        "monthly_payment": int(round(estimated_mp / 1000) * 1000),
        "total_amount": total_price,
        "score": score_result["total_score"],
        "status": app_status,
        "approved_amount": financed,  # store financed as approved_amount for confirm step
    }

    # Try storing extra fields (columns may not exist in Supabase)
    items_json = json.dumps(
        [{"product_id": it.product_id, "quantity": it.quantity} for it in body.items]
    )
    try:
        application = (
            db.table("applications")
            .insert({**app_data, "application_items": items_json})
            .execute()
            .data[0]
        )
    except Exception:
        application = db.table("applications").insert(app_data).execute().data[0]

    # 12. Scoring log
    try:
        db.table("scoring_logs").insert(
            {
                "id": str(uuid.uuid4()),
                "application_id": application["id"],
                "client_id": client_id,
                "income_score": score_result["f1_affordability"],
                "credit_score": score_result["f2_credit"],
                "age_score": score_result["f4_demographic"],
                "tariff_score": score_result["f3_behavioral"],
                "total_score": score_result["total_score"],
                "outcome": score_result["decision"],
                "weights_snapshot": score_result["weights"],
                "hard_reject": score_result["hard_reject"],
                "hard_reject_reason": score_result["hard_reject_reason"],
                "reason_codes": score_result["reason_codes"],
            }
        ).execute()
    except Exception:
        pass

    log_action(
        db,
        current_user["id"],
        "CREATE_MULTI",
        "application",
        application["id"],
        request.client.host if request.client else "",
    )

    return MultiProductResponse(
        id=application["id"],
        score_result={
            "f1": score_result["f1_affordability"],
            "f2": score_result["f2_credit"],
            "f3": score_result["f3_behavioral"],
            "f4": score_result["f4_demographic"],
            "total_score": score_result["total_score"],
            "decision": score_result["decision"],
            "weights": score_result["weights"],
            "hard_reject": score_result["hard_reject"],
            "hard_reject_reason": score_result["hard_reject_reason"],
            "reason_codes": score_result["reason_codes"],
            "approved_ratio": score_result["approved_ratio"],
        },
        eligible_offers=eligible_offers,
        fraud_gate=fraud_gate,
        fraud_signals=fraud_signals,
    )


# ── POST /{id}/confirm ─────────────────────────────────────────────────────────


@router.post("/{application_id}/confirm", response_model=ConfirmResponse)
def confirm_application(
    application_id: str,
    body: ConfirmRequest,
    request: Request,
    current_user: dict = Depends(require_role("MERCHANT")),
    db: Client = Depends(get_supabase),
):
    rows = db.table("applications").select("*").eq("id", application_id).execute().data
    if not rows:
        raise HTTPException(404, "Application not found")
    app = rows[0]

    tariff_rows = (
        db.table("tariffs").select("*").eq("id", body.tariff_id).execute().data
    )
    if not tariff_rows:
        raise HTTPException(404, "Tariff not found")
    tariff = tariff_rows[0]

    if body.months not in (3, 6, 9, 12):
        raise HTTPException(422, "Months must be one of 3, 6, 9, 12")

    # Use stored financed_amount (stored as approved_amount in draft)
    financed = app.get("approved_amount") or app.get("total_amount", 0)
    mp = calc_monthly_payment(financed, body.months, tariff["interest_rate"])
    mp_rounded = int(round(mp / 1000) * 1000)
    total = mp_rounded * body.months

    updates: dict = {
        "tariff_id": body.tariff_id,
        "months": body.months,
        "monthly_payment": mp_rounded,
        "total_amount": total,
        "status": "APPROVED",
        "client_signature": body.signature_b64,
        "decided_at": datetime.now(timezone.utc).isoformat(),
    }

    updated = (
        db.table("applications")
        .update(updates)
        .eq("id", application_id)
        .execute()
        .data[0]
    )

    # Auto-create contract + payment schedule
    contract_id = None
    contract_data = {
        "id": str(uuid.uuid4()),
        "application_id": updated["id"],
        "total_amount": total,
        "months": body.months,
        "monthly_payment": mp_rounded,
        "paid_installments": 0,
        "status": "ACTIVE",
    }
    contract = db.table("contracts").insert(contract_data).execute().data[0]
    contract_id = contract["id"]

    schedule = generate_payment_schedule(
        contract_id,
        datetime.now(timezone.utc).date(),
        mp_rounded,
        body.months,
    )
    db.table("installments").insert(schedule).execute()

    log_action(
        db,
        current_user["id"],
        "CONFIRM",
        "application",
        application_id,
        request.client.host if request.client else "",
    )

    return ConfirmResponse(
        id=updated["id"],
        status=updated["status"],
        monthly_payment=mp_rounded,
        total_amount=total,
        months=body.months,
        contract_id=contract_id,
    )
