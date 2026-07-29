from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class WateringEvent(Base):
    """Append-only log. Never updated, never deleted, never cascaded away.

    RESTRICT rather than CASCADE is deliberate — plants soft-delete precisely so
    this history survives them.
    """

    __tablename__ = "watering_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="RESTRICT"), index=True)
    watered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
