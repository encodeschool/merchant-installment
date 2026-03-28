import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone
from .core.database import SessionLocal, Base, engine
from .core.security import hash_password
from .models.user import User
from .models.tariff import Tariff
from .models.merchant import Merchant
from .models.product import Product

Base.metadata.create_all(bind=engine)


def seed():
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == "akbar@centralbank.uz").first():
            print("Database already seeded.")
            return

        cb_user = User(
            name="Akbar Toshmatov",
            email="akbar@centralbank.uz",
            hashed_password=hash_password("demo1234"),
            role="CENTRAL_BANK",
            organization="O'zbekiston Markaziy Banki",
            is_active=True,
        )
        db.add(cb_user)

        mfo_user = User(
            name="Dilnoza Yusupova",
            email="dilnoza@ipoteka.uz",
            hashed_password=hash_password("demo1234"),
            role="MFO_ADMIN",
            organization="Ipoteka Bank MFO",
            is_active=True,
        )
        db.add(mfo_user)

        merchant_user = User(
            name="Bobur Xolmatov",
            email="bobur@techmart.uz",
            hashed_password=hash_password("demo1234"),
            role="MERCHANT",
            organization="TechMart Savdo",
            is_active=True,
        )
        db.add(merchant_user)
        db.commit()
        db.refresh(cb_user)
        db.refresh(mfo_user)
        db.refresh(merchant_user)

        tariff1 = Tariff(
            name="Standart 12 oy",
            mfo_user_id=mfo_user.id,
            interest_rate=24.0,
            min_amount=1_000_000,
            max_amount=50_000_000,
            min_months=3,
            max_months=12,
            min_score=60,
            status="APPROVED",
            approved_at=datetime.now(timezone.utc),
            approved_by=cb_user.id,
        )
        db.add(tariff1)

        tariff2 = Tariff(
            name="Premium 6 oy",
            mfo_user_id=mfo_user.id,
            interest_rate=18.0,
            min_amount=5_000_000,
            max_amount=100_000_000,
            min_months=6,
            max_months=12,
            min_score=70,
            status="APPROVED",
            approved_at=datetime.now(timezone.utc),
            approved_by=cb_user.id,
        )
        db.add(tariff2)
        db.commit()

        merchant1 = Merchant(
            name="TechMart Savdo",
            legal_name='TechMart Savdo MCHJ',
            category="Electronics",
            phone="+998901234567",
            address="Toshkent, Chilonzor ko'chasi 12",
            mfo_user_id=mfo_user.id,
            status="ACTIVE",
        )
        db.add(merchant1)

        merchant2 = Merchant(
            name="MobiShop",
            legal_name="MobiShop OAJ",
            category="Electronics",
            phone="+998907654321",
            address="Toshkent, Yunusobod 5",
            mfo_user_id=mfo_user.id,
            status="ACTIVE",
        )
        db.add(merchant2)

        merchant3 = Merchant(
            name="HomeStyle",
            legal_name="HomeStyle MCHJ",
            category="Furniture",
            phone="+998909876543",
            address="Toshkent, Mirzo Ulug'bek 33",
            mfo_user_id=mfo_user.id,
            status="PENDING",
        )
        db.add(merchant3)
        db.commit()
        db.refresh(merchant1)
        db.refresh(merchant2)
        db.refresh(merchant3)

        products = [
            Product(
                merchant_id=merchant1.id,
                name="Samsung Galaxy S24 Ultra",
                category="Smartphones",
                price=12_000_000,
                description="Samsung Galaxy S24 Ultra 256GB",
                available=True,
                down_payment_percent=20,
            ),
            Product(
                merchant_id=merchant1.id,
                name="MacBook Air M2",
                category="Laptops",
                price=25_000_000,
                description="Apple MacBook Air 13 M2 8GB/256GB",
                available=True,
                down_payment_percent=30,
            ),
            Product(
                merchant_id=merchant2.id,
                name="iPhone 15 Pro",
                category="Smartphones",
                price=15_000_000,
                description="Apple iPhone 15 Pro 128GB",
                available=True,
                down_payment_percent=25,
            ),
            Product(
                merchant_id=merchant2.id,
                name="Samsung 55\" QLED TV",
                category="TVs",
                price=8_000_000,
                description="Samsung 55 inch 4K QLED Smart TV",
                available=True,
                down_payment_percent=15,
            ),
            Product(
                merchant_id=merchant3.id,
                name="Divan-Krovat 3+1+1",
                category="Furniture",
                price=6_500_000,
                description="Zamonaviy divan to'plami",
                available=True,
                down_payment_percent=10,
            ),
        ]
        for p in products:
            db.add(p)
        db.commit()

        print("Seed completed successfully.")
        print("  akbar@centralbank.uz / demo1234  (CENTRAL_BANK)")
        print("  dilnoza@ipoteka.uz / demo1234    (MFO_ADMIN)")
        print("  bobur@techmart.uz / demo1234     (MERCHANT)")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
