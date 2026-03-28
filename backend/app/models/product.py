import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, BigInteger, Integer, DateTime, ForeignKey
from app.core.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id = Column(String, ForeignKey("merchants.id"), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    price = Column(BigInteger, nullable=False)
    description = Column(String, nullable=True, default="")
    available = Column(Boolean, default=True, nullable=False)
    down_payment_percent = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
