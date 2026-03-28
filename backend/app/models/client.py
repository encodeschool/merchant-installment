import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, BigInteger, Integer, DateTime, Enum as SAEnum
from app.core.database import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String, nullable=False)
    passport_number = Column(String, unique=True, nullable=False, index=True)
    phone = Column(String, nullable=False)
    monthly_income = Column(BigInteger, nullable=False)
    age = Column(Integer, nullable=False)
    credit_history = Column(SAEnum("GOOD", "FAIR", "BAD", "NONE", name="credit_history"), default="NONE", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
