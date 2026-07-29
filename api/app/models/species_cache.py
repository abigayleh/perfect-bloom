from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UtcDateTime, utcnow


class SpeciesCache(Base):
    """Resolved PlantNet-name -> Perenual-care mappings.

    Doubles as the rate-limit defense and the place manual corrections live, so a
    row is written even for a miss (match_kind="none") to stop re-querying it.
    """

    __tablename__ = "species_cache"

    id: Mapped[int] = mapped_column(primary_key=True)
    normalized_name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    match_kind: Mapped[str] = mapped_column(String(16))  # exact | genus | none

    perenual_id: Mapped[int | None] = mapped_column(Integer, default=None)
    common_name: Mapped[str | None] = mapped_column(String(255), default=None)
    watering: Mapped[str | None] = mapped_column(String(64), default=None)
    sunlight: Mapped[list[str] | None] = mapped_column(JSON, default=None)
    cycle: Mapped[str | None] = mapped_column(String(64), default=None)

    # Tri-state on purpose: NULL means "unknown", which the UI must never render as "safe".
    poisonous_to_pets: Mapped[bool | None] = mapped_column(Boolean, default=None)
    poisonous_to_humans: Mapped[bool | None] = mapped_column(Boolean, default=None)

    payload: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=None)
    fetched_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow)
