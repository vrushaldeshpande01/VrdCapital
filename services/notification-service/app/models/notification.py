import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class NotificationType(str, enum.Enum):
    ORDER_EXECUTED = "ORDER_EXECUTED"
    ORDER_FAILED = "ORDER_FAILED"
    ORDER_CANCELLED = "ORDER_CANCELLED"
    BASKET_COMPLETED = "BASKET_COMPLETED"
    BASKET_FAILED = "BASKET_FAILED"
    KYC_UPDATED = "KYC_UPDATED"
    CLIENT_ADDED = "CLIENT_ADDED"
    SYSTEM = "SYSTEM"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    type = Column(SAEnum(NotificationType), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    metadata_json = Column(Text, nullable=True)   # JSON string for extra data
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    read_at = Column(DateTime(timezone=True), nullable=True)
