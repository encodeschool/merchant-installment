import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, BigInteger, Integer, DateTime, Enum as SAEnum, ForeignKey
from ..core.database import Base


class Application(Base):
    __tablename__ = "applications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id = Column(String, ForeignKey("merchants.id"), nullable=False)
    client_id = Column(String, ForeignKey("clients.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    tariff_id = Column(String, ForeignKey("tariffs.id"), nullable=False)
    months = Column(Integer, nullable=False)
    monthly_payment = Column(BigInteger, nullable=False)
    total_amount = Column(BigInteger, nullable=False)
    score = Column(Integer, nullable=False, default=0)
    status = Column(
        SAEnum("PENDING", "APPROVED", "PARTIAL", "REJECTED", "ACTIVE", "COMPLETED", name="application_status"),
        default="PENDING",
        nullable=False,
    )
    approved_amount = Column(BigInteger, nullable=True)
    decided_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    decided_at = Column(DateTime(timezone=True), nullable=True)
