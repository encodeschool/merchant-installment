import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from app.core.database import Base


class ScoringLog(Base):
    __tablename__ = "scoring_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    application_id = Column(String, ForeignKey("applications.id"), nullable=True)
    client_id = Column(String, ForeignKey("clients.id"), nullable=False)
    income_score = Column(Integer, nullable=False)
    credit_score = Column(Integer, nullable=False)
    age_score = Column(Integer, nullable=False)
    tariff_score = Column(Integer, nullable=False)
    total_score = Column(Integer, nullable=False)
    outcome = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
