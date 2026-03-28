import uuid
import base64
import hashlib
import json
from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException, status, Request
from supabase import Client

from ..core.database import get_supabase
from ..core.deps import get_current_user, require_role
from ..schemas.application import (
    ApplicationCreate, DecisionRequest, ApplicationOut,
    MultiProductCreate, MultiProductResponse, ConfirmRequest, ConfirmResponse,
)
from ..services.scoring import calculate_score, calculate_score_full, monthly_payment as calc_monthly_payment
from ..services.contract import generate_payment_schedule
from ..services.audit import log_action
from ..services.fraud import check_fraud_gate

router = APIRouter()


def _app_to_out(app: dict, db: Client) -> ApplicationOut:
    merchant = (
        db.table("merchants").select("name").eq("id", app["merchant_id"]).execute().data
    )
    client = (
        db.table("clients")
        .select("full_name, phone")
        .eq("id", app["client_id"])
        .execute()
        .data
    )
    product = (
        db.table("products")
        .select("name, price")
        .eq("id", app["product_id"])
        .execute()
        .data
    )
    tariff = (
        db.table("tariffs").select("name").eq("id", app["tariff_id"]).execute().data
    )

    return ApplicationOut(
        id=app["id"],
        merchantId=app["merchant_id"],
        merchantName=merchant[0]["name"] if merchant else "",
        clientName=client[0]["full_name"] if client else "",
        clientPhone=client[0]["phone"] if client else "",
        productName=product[0]["name"] if product else "",
        productPrice=product[0]["price"] if product else 0,
        tariffId=app["tariff_id"],
        tariffName=tariff[0]["name"] if tariff else "",
        months=app["months"],
        monthlyPayment=app["monthly_payment"],
        totalAmount=app["total_amount"],
        score=app["score"],
        status=app["status"],
        approvedAmount=app.get("approved_amount"),
        createdAt=app["created_at"],
        decidedAt=app.get("decided_at"),
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


@router.get("", response_model=list[ApplicationOut])
def list_applications(
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    if current_user["role"] == "MERCHANT":
        merchants = (
            db.table("merchants")
            .select("id")
            .eq("name", current_user["organization"])
            .execute()
            .data
        )
        if not merchants:
            return []
        apps = (
            db.table("applications")
            .select("*")
            .eq("merchant_id", merchants[0]["id"])
            .order("created_at", desc=True)
            .execute()
            .data
        )
    else:
        apps = (
            db.table("applications")
            .select("*")
            .order("created_at", desc=True)
            .execute()
            .data
        )

    if not apps:
        return []

    # Batch fetch all related data to avoid N+1 queries
    merchant_ids = list(set(a["merchant_id"] for a in apps))
    client_ids = list(set(a["client_id"] for a in apps))
    product_ids = list(set(a["product_id"] for a in apps))
    tariff_ids = list(set(a["tariff_id"] for a in apps))

    merchants_data = (
        db.table("merchants").select("id, name").in_("id", merchant_ids).execute().data
    )
    clients_data = (
        db.table("clients")
        .select("id, full_name, phone")
        .in_("id", client_ids)
        .execute()
        .data
    )
    products_data = (
        db.table("products")
        .select("id, name, price")
        .in_("id", product_ids)
        .execute()
        .data
    )
    tariffs_data = (
        db.table("tariffs").select("id, name").in_("id", tariff_ids).execute().data
    )

    # Create lookup dictionaries
    merchants_map = {m["id"]: m for m in merchants_data}
    clients_map = {c["id"]: c for c in clients_data}
    products_map = {p["id"]: p for p in products_data}
    tariffs_map = {t["id"]: t for t in tariffs_data}

    # Build response objects
    result = []
    for app in apps:
        merchant = merchants_map.get(app["merchant_id"], {})
        client = clients_map.get(app["client_id"], {})
        product = products_map.get(app["product_id"], {})
        tariff = tariffs_map.get(app["tariff_id"], {})

        result.append(
            ApplicationOut(
                id=app["id"],
                merchantId=app["merchant_id"],
                merchantName=merchant.get("name", ""),
                clientName=client.get("full_name", ""),
                clientPhone=client.get("phone", ""),
                productName=product.get("name", ""),
                productPrice=product.get("price", 0),
                tariffId=app["tariff_id"],
                tariffName=tariff.get("name", ""),
                months=app["months"],
                monthlyPayment=app["monthly_payment"],
                totalAmount=app["total_amount"],
                score=app["score"],
                status=app["status"],
                approvedAmount=app.get("approved_amount"),
                createdAt=app["created_at"],
                decidedAt=app.get("decided_at"),
            )
        )

    return result


@router.get("/{application_id}", response_model=ApplicationOut)
def get_application(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    rows = db.table("applications").select("*").eq("id", application_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Application not found")
    return _app_to_out(rows[0], db)


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
    w_affordability=0.40, w_credit=0.30, w_behavioral=0.20, w_demographic=0.10,
    min_score=60, partial_threshold=45, partial_ratio=0.70,
    hard_dti_min=1.5, max_open_loans=5, max_overdue_days=90, bankruptcy_reject=True,
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


def _run_scoring(client_data: dict, mp: float, tariff: dict | None, fraud_gate: str) -> dict:
    """Run calculate_score_full with tariff config (or defaults). Apply fraud penalty."""
    cfg = tariff if tariff else {}
    result = calculate_score_full(
        monthly_income=client_data.get("monthly_income", 0),
        monthly_payment=mp,
        age=client_data.get("age", 30),
        credit_history=client_data.get("credit_history", "NONE"),
        open_loans=client_data.get("open_loans", 0),
        overdue_days=client_data.get("overdue_days", 0),
        has_bankruptcy=client_data.get("has_bankruptcy", False),
        w_affordability=cfg.get("w_affordability", _DEFAULT_WEIGHTS["w_affordability"]),
        w_credit=cfg.get("w_credit_history", _DEFAULT_WEIGHTS["w_credit"]),
        w_behavioral=cfg.get("w_behavioral", _DEFAULT_WEIGHTS["w_behavioral"]),
        w_demographic=cfg.get("w_demographic", _DEFAULT_WEIGHTS["w_demographic"]),
        min_score=cfg.get("min_score", _DEFAULT_WEIGHTS["min_score"]),
        partial_threshold=cfg.get("partial_threshold", _DEFAULT_WEIGHTS["partial_threshold"]),
        partial_ratio=cfg.get("partial_ratio", _DEFAULT_WEIGHTS["partial_ratio"]),
        hard_dti_min=cfg.get("hard_dti_min", _DEFAULT_WEIGHTS["hard_dti_min"]),
        max_open_loans=cfg.get("max_open_loans", _DEFAULT_WEIGHTS["max_open_loans"]),
        max_overdue_days=cfg.get("max_overdue_days", _DEFAULT_WEIGHTS["max_overdue_days"]),
        bankruptcy_reject=cfg.get("bankruptcy_reject", _DEFAULT_WEIGHTS["bankruptcy_reject"]),
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
    merchant_rows = db.table("merchants").select("*").eq("id", body.merchant_id).execute().data
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
            raise HTTPException(400, f"Product {p['name']} does not belong to this merchant")
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
    all_tariffs = db.table("tariffs").select("*").eq("status", "APPROVED").execute().data or []
    eligible_tariffs = [
        t for t in all_tariffs
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
    max_down_pct = max((p["product"].get("down_payment_percent", 0) for p in products), default=0)
    down_amount = int(total_price * max_down_pct / 100)
    financed = total_price - down_amount

    # 8. Score
    if fraud_gate == "BLOCK":
        score_result = {
            "hard_reject": True, "hard_reject_reason": "FRAUD_BLOCK",
            "f1_affordability": 0, "f2_credit": 0, "f3_behavioral": 0, "f4_demographic": 0,
            "weights": {"w1": 0.4, "w2": 0.3, "w3": 0.2, "w4": 0.1},
            "total_score": 0, "decision": "REJECTED", "approved_ratio": 0.0,
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
        approved_amount = int(financed * approved_ratio) if approved_ratio > 0 else financed
        for tariff in eligible_tariffs:
            min_m = tariff.get("min_months", 3)
            max_m = tariff.get("max_months", 12)
            av_months = [m for m in [3, 6, 9, 12] if min_m <= m <= max_m] or [3, 6, 9, 12]
            min_mp = calc_monthly_payment(approved_amount, max(av_months), tariff["interest_rate"])
            max_mp = calc_monthly_payment(approved_amount, min(av_months), tariff["interest_rate"])
            eligible_offers.append({
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
            })

    # 10. Upsert client
    existing = db.table("clients").select("*").eq(
        "passport_number", body.client.passport_number
    ).execute().data
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
        any_t = db.table("tariffs").select("id").eq("status", "APPROVED").limit(1).execute().data
        if any_t:
            primary_tariff_id = any_t[0]["id"]
    if not primary_tariff_id:
        raise HTTPException(400, "No approved tariffs found in the system")

    primary_product_id = products[0]["product"]["id"]
    app_status = "BLOCKED" if fraud_gate == "BLOCK" else "DRAFT"
    estimated_mp = calc_monthly_payment(
        financed, body.months if body.months in (3, 6, 9, 12) else 12,
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
    items_json = json.dumps([
        {"product_id": it.product_id, "quantity": it.quantity} for it in body.items
    ])
    try:
        application = db.table("applications").insert(
            {**app_data, "application_items": items_json}
        ).execute().data[0]
    except Exception:
        application = db.table("applications").insert(app_data).execute().data[0]

    # 12. Scoring log
    try:
        db.table("scoring_logs").insert({
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
        }).execute()
    except Exception:
        pass

    log_action(
        db, current_user["id"], "CREATE_MULTI", "application", application["id"],
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

    tariff_rows = db.table("tariffs").select("*").eq("id", body.tariff_id).execute().data
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
        "status": "PENDING",
    }

    try:
        updated = db.table("applications").update(
            {**updates, "signature": body.signature_b64}
        ).eq("id", application_id).execute().data[0]
    except Exception:
        updated = db.table("applications").update(updates).eq("id", application_id).execute().data[0]

    log_action(
        db, current_user["id"], "CONFIRM", "application", application_id,
        request.client.host if request.client else "",
    )

    return ConfirmResponse(
        id=updated["id"],
        status=updated["status"],
        monthly_payment=mp_rounded,
        total_amount=total,
        months=body.months,
    )
