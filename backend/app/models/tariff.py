import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, BigInteger, Integer, DateTime, Enum as SAEnum, ForeignKey
from app.core.database import Base


class Tariff(Base):
    __tablename__ = "tariffs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    mfo_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    interest_rate = Column(Float, nullable=False)
    min_amount = Column(BigInteger, nullable=False)
    max_amount = Column(BigInteger, nullable=False)
    min_months = Column(Integer, nullable=False)
    max_months = Column(Integer, nullable=False)
    min_score = Column(Integer, nullable=False)
    status = Column(SAEnum("PENDING", "APPROVED", "REJECTED", name="tariff_status"), default="PENDING", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(String, ForeignKey("users.id"), nullable=True)
