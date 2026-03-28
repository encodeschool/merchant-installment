import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request
from supabase import Client

from ..core.database import get_supabase
from ..core.deps import get_current_user, require_role
from ..schemas.product import ProductCreate, ProductUpdate, ProductOut

router = APIRouter()


def _product_to_out(p: dict) -> ProductOut:
    return ProductOut(
        id=p["id"],
        merchantId=p["merchant_id"],
        name=p["name"],
        category=p["category"],
        price=p["price"],
        description=p.get("description") or "",
        available=p["available"],
        downPaymentPercent=p["down_payment_percent"],
    )


def _check_merchant_access(db: Client, merchant_id: str, user: dict):
    rows = db.table("merchants").select("id, name").eq("id", merchant_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Merchant not found")
    if user["role"] == "MERCHANT" and rows[0]["name"] != user["organization"]:
        raise HTTPException(status_code=403, detail="Access denied to this merchant")


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    body: ProductCreate,
    request: Request,
    current_user: dict = Depends(require_role("MERCHANT")),
    db: Client = Depends(get_supabase),
):
    _check_merchant_access(db, body.merchant_id, current_user)
    data = {
        "id": str(uuid.uuid4()),
        "merchant_id": body.merchant_id,
        "name": body.name,
        "category": body.category,
        "price": body.price,
        "description": body.description,
        "available": body.available,
        "down_payment_percent": body.down_payment_percent,
    }
    product = db.table("products").insert(data).execute().data[0]
    return _product_to_out(product)


@router.get("", response_model=list[ProductOut])
def list_products(
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    if current_user["role"] == "MERCHANT":
        merchants = db.table("merchants").select("id").eq("name", current_user["organization"]).execute().data
        if not merchants:
            return []
        products = db.table("products").select("*").eq("merchant_id", merchants[0]["id"]).execute().data
    else:
        products = db.table("products").select("*").execute().data
    return [_product_to_out(p) for p in products]


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    rows = db.table("products").select("*").eq("id", product_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Product not found")
    return _product_to_out(rows[0])


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: str,
    body: ProductUpdate,
    current_user: dict = Depends(require_role("MERCHANT")),
    db: Client = Depends(get_supabase),
):
    rows = db.table("products").select("*").eq("id", product_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Product not found")
    _check_merchant_access(db, rows[0]["merchant_id"], current_user)
    updates = body.model_dump(exclude_none=True)
    product = db.table("products").update(updates).eq("id", product_id).execute().data[0]
    return _product_to_out(product)


@router.patch("/{product_id}/availability", response_model=ProductOut)
def toggle_availability(
    product_id: str,
    current_user: dict = Depends(require_role("MERCHANT")),
    db: Client = Depends(get_supabase),
):
    rows = db.table("products").select("*").eq("id", product_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Product not found")
    _check_merchant_access(db, rows[0]["merchant_id"], current_user)
    product = db.table("products").update({"available": not rows[0]["available"]}).eq("id", product_id).execute().data[0]
    return _product_to_out(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: str,
    current_user: dict = Depends(require_role("MERCHANT")),
    db: Client = Depends(get_supabase),
):
    rows = db.table("products").select("*").eq("id", product_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Product not found")
    _check_merchant_access(db, rows[0]["merchant_id"], current_user)
    db.table("products").delete().eq("id", product_id).execute()
