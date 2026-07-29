from datetime import datetime

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UtcDateTime, utcnow


class Device(Base):
    """An anonymous app install, holding no personal data whatsoever.

    This exists only to meter the identify/care proxy — those routes spend
    PlantNet and Perenual credits, so they cannot be open. There is no email, no
    password, and nothing tying a row to a person; the plants themselves live on
    the device and the server never sees them.
    """

    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Digest only, exactly as auth tokens were: the token is already
    # high-entropy, so a slow hash on every request would buy nothing.
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow)

    # Quota, reset on the first call of a new UTC day rather than by a scheduler.
    quota_day: Mapped[str | None] = mapped_column(String(10), default=None)
    quota_used: Mapped[int] = mapped_column(Integer, default=0)
