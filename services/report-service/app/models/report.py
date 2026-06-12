import uuid, enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Text, Enum as SAEnum, Float
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class ReportType(str, enum.Enum):
    PORTFOLIO_SUMMARY = "portfolio_summary"
    CLIENT_STATEMENT = "client_statement"
    TAX_REPORT = "tax_report"
    PERFORMANCE = "performance"
    ORDER_HISTORY = "order_history"

class ReportFormat(str, enum.Enum):
    PDF = "PDF"
    XLSX = "XLSX"
    CSV = "CSV"

class ReportStatus(str, enum.Enum):
    PENDING = "PENDING"
    GENERATING = "GENERATING"
    READY = "READY"
    FAILED = "FAILED"

class ReportPeriod(str, enum.Enum):
    THIS_MONTH = "this_month"
    LAST_MONTH = "last_month"
    THIS_QUARTER = "this_quarter"
    THIS_FY = "this_fy"
    LAST_FY = "last_fy"
    CUSTOM = "custom"

class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by = Column(UUID(as_uuid=True), nullable=False, index=True)
    report_type = Column(SAEnum(ReportType), nullable=False)
    format = Column(SAEnum(ReportFormat), nullable=False)
    period = Column(SAEnum(ReportPeriod), nullable=False)
    date_from = Column(String(20), nullable=True)
    date_to = Column(String(20), nullable=True)
    status = Column(SAEnum(ReportStatus), default=ReportStatus.PENDING, nullable=False)
    name = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer, nullable=True)
    # Store generated file as base64 in DB for simplicity (Phase 5 — S3 in production)
    file_data = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)
