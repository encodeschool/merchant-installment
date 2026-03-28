import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, BigInteger, Integer, DateTime, Date, Enum as SAEnum, ForeignKey
from app.core.database import Base


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    application_id = Column(String, ForeignKey("applications.id"), unique=True, nullable=False)
    total_amount = Column(BigInteger, nullable=False)
    months = Column(Integer, nullable=False)
    monthly_payment = Column(BigInteger, nullable=False)
    paid_installments = Column(Integer, default=0, nullable=False)
    status = Column(SAEnum("ACTIVE", "COMPLETED", "DEFAULTED", name="contract_status"), default="ACTIVE", nullable=False)
    pdf_path = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class Installment(Base):
    __tablename__ = "installments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    contract_id = Column(String, ForeignKey("contracts.id"), nullable=False)
    installment_number = Column(Integer, nullable=False)
    due_date = Column(Date, nullable=False)
    amount = Column(BigInteger, nullable=False)
    paid_at = Column(Date, nullable=True)
    status = Column(SAEnum("UPCOMING", "PAID", "OVERDUE", name="installment_status"), default="UPCOMING", nullable=False)
