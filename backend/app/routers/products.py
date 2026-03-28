from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user, require_role
from ..models.user import User
from ..models.merchant import Merchant
from ..models.product import Product
from ..schemas.product import ProductCreate, ProductUpdate, ProductOut

router = APIRouter()


def _product_to_out(product: Product) -> ProductOut:
    return ProductOut(
        id=product.id,
        merchantId=product.merchant_id,
        name=product.name,
        category=product.category,
        price=product.price,
        description=product.description or "",
        available=product.available,
        downPaymentPercent=product.down_payment_percent,
    )


def _get_merchant_for_user(db: Session, merchant_id: str, user: User) -> Merchant:
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    if user.role == "MERCHANT":
        linked = db.query(Merchant).filter(Merchant.name == user.organization, Merchant.id == merchant_id).first()
        if not linked:
            linked = db.query(Merchant).filter(Merchant.id == merchant_id).first()
            if linked and linked.name != user.organization:
                raise HTTPException(status_code=403, detail="Access denied to this merchant")
    return merchant


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    body: ProductCreate,
    request: Request,
    current_user: User = Depends(require_role("MERCHANT")),
    db: Session = Depends(get_db),
):
    _get_merchant_for_user(db, body.merchant_id, current_user)
    product = Product(
        merchant_id=body.merchant_id,
        name=body.name,
        category=body.category,
        price=body.price,
        description=body.description,
        available=body.available,
        down_payment_percent=body.down_payment_percent,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return _product_to_out(product)


@router.get("", response_model=list[ProductOut])
def list_products(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "MERCHANT":
        merchant = db.query(Merchant).filter(Merchant.name == current_user.organization).first()
        if merchant:
            products = db.query(Product).filter(Product.merchant_id == merchant.id).all()
        else:
            products = []
    else:
        products = db.query(Product).all()
    return [_product_to_out(p) for p in products]


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _product_to_out(product)


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: str,
    body: ProductUpdate,
    current_user: User = Depends(require_role("MERCHANT")),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    _get_merchant_for_user(db, product.merchant_id, current_user)

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return _product_to_out(product)


@router.patch("/{product_id}/availability", response_model=ProductOut)
def toggle_availability(
    product_id: str,
    current_user: User = Depends(require_role("MERCHANT")),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    _get_merchant_for_user(db, product.merchant_id, current_user)
    product.available = not product.available
    db.commit()
    db.refresh(product)
    return _product_to_out(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: str,
    current_user: User = Depends(require_role("MERCHANT")),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    _get_merchant_for_user(db, product.merchant_id, current_user)
    db.delete(product)
    db.commit()
