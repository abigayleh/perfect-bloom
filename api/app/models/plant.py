from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UtcDateTime, utcnow


class Plant(Base):
    """A plant in a user's collection.

    Care facts are not copied here — they live in species_cache and are read
    through it, so there is one source of truth per species. Only interval_days
    is per-plant, because the user can override it.
    """

    __tablename__ = "plants"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    nickname: Mapped[str | None] = mapped_column(String(120), default=None)
    scientific_name: Mapped[str] = mapped_column(String(255), default="")
    common_name: Mapped[str | None] = mapped_column(String(255), default=None)
    image_key: Mapped[str | None] = mapped_column(String(255), default=None)

    interval_days: Mapped[int | None] = mapped_column(Integer, default=None)
    species_cache_id: Mapped[int | None] = mapped_column(
        ForeignKey("species_cache.id"), default=None, index=True
    )

    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow)
    # Soft delete: watering_events must outlive the plant they belong to.
    deleted_at: Mapped[datetime | None] = mapped_column(UtcDateTime, default=None)
