import sys
import os
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import supabase as db
from app.core.security import hash_password


def seed():
    existing = db.table("users").select("id").eq("email", "dilnoza@ipoteka.uz").execute().data
    if existing:
        print("Database already seeded.")
        return

    mfo_id = str(uuid.uuid4())
    merchant_user_id = str(uuid.uuid4())

    db.table("users").insert([
        {
            "id": mfo_id,
            "name": "Dilnoza Yusupova",
            "email": "dilnoza@ipoteka.uz",
            "hashed_password": hash_password("demo1234"),
            "role": "MFO_ADMIN",
            "organization": "Ipoteka Bank MFO",
            "is_active": True,
        },
        {
            "id": merchant_user_id,
            "name": "Bobur Xolmatov",
            "email": "bobur@techmart.uz",
            "hashed_password": hash_password("demo1234"),
            "role": "MERCHANT",
            "organization": "TechMart Savdo",
            "is_active": True,
        },
    ]).execute()

    tariff1_id = str(uuid.uuid4())
    tariff2_id = str(uuid.uuid4())
    db.table("tariffs").insert([
        {
            "id": tariff1_id,
            "name": "Standart 12 oy",
            "mfo_user_id": mfo_id,
            "interest_rate": 24.0,
            "min_amount": 1_000_000,
            "max_amount": 50_000_000,
            "min_months": 3,
            "max_months": 12,
            "min_score": 60,
            "status": "APPROVED",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": mfo_id,
        },
        {
            "id": tariff2_id,
            "name": "Premium 6 oy",
            "mfo_user_id": mfo_id,
            "interest_rate": 18.0,
            "min_amount": 5_000_000,
            "max_amount": 100_000_000,
            "min_months": 6,
            "max_months": 12,
            "min_score": 70,
            "status": "APPROVED",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": mfo_id,
        },
    ]).execute()

    merchant1_id = str(uuid.uuid4())
    merchant2_id = str(uuid.uuid4())
    merchant3_id = str(uuid.uuid4())
    db.table("merchants").insert([
        {
            "id": merchant1_id,
            "name": "TechMart Savdo",
            "legal_name": "TechMart Savdo MCHJ",
            "category": "Electronics",
            "phone": "+998901234567",
            "address": "Toshkent, Chilonzor ko'chasi 12",
            "mfo_user_id": mfo_id,
            "status": "ACTIVE",
        },
        {
            "id": merchant2_id,
            "name": "MobiShop",
            "legal_name": "MobiShop OAJ",
            "category": "Electronics",
            "phone": "+998907654321",
            "address": "Toshkent, Yunusobod 5",
            "mfo_user_id": mfo_id,
            "status": "ACTIVE",
        },
        {
            "id": merchant3_id,
            "name": "HomeStyle",
            "legal_name": "HomeStyle MCHJ",
            "category": "Furniture",
            "phone": "+998909876543",
            "address": "Toshkent, Mirzo Ulug'bek 33",
            "mfo_user_id": mfo_id,
            "status": "PENDING",
        },
    ]).execute()

    db.table("products").insert([
        {
            "id": str(uuid.uuid4()),
            "merchant_id": merchant1_id,
            "name": "Samsung Galaxy S24 Ultra",
            "category": "Smartphones",
            "price": 12_000_000,
            "description": "Samsung Galaxy S24 Ultra 256GB",
            "available": True,
            "down_payment_percent": 20,
        },
        {
            "id": str(uuid.uuid4()),
            "merchant_id": merchant1_id,
            "name": "MacBook Air M2",
            "category": "Laptops",
            "price": 25_000_000,
            "description": "Apple MacBook Air 13 M2 8GB/256GB",
            "available": True,
            "down_payment_percent": 30,
        },
        {
            "id": str(uuid.uuid4()),
            "merchant_id": merchant2_id,
            "name": "iPhone 15 Pro",
            "category": "Smartphones",
            "price": 15_000_000,
            "description": "Apple iPhone 15 Pro 128GB",
            "available": True,
            "down_payment_percent": 25,
        },
        {
            "id": str(uuid.uuid4()),
            "merchant_id": merchant2_id,
            "name": "Samsung 55\" QLED TV",
            "category": "TVs",
            "price": 8_000_000,
            "description": "Samsung 55 inch 4K QLED Smart TV",
            "available": True,
            "down_payment_percent": 15,
        },
        {
            "id": str(uuid.uuid4()),
            "merchant_id": merchant3_id,
            "name": "Divan-Krovat 3+1+1",
            "category": "Furniture",
            "price": 6_500_000,
            "description": "Zamonaviy divan to'plami",
            "available": True,
            "down_payment_percent": 10,
        },
    ]).execute()

    print("Seed completed successfully.")
    print("  dilnoza@ipoteka.uz / demo1234  (MFO_ADMIN)")
    print("  bobur@techmart.uz / demo1234   (MERCHANT)")


if __name__ == "__main__":
    seed()
