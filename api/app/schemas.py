from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class SignupRequest(BaseModel):
    email: str
    password: str
    timezone: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    timezone: str


class TokenOut(BaseModel):
    token: str
    user: UserOut


class AttributionOut(BaseModel):
    """Provider credit the client is required to display alongside results."""

    text: str
    url: str
    logo_path: str | None = None


class CandidateOut(BaseModel):
    scientific_name: str
    common_names: list[str]
    score: float
    confidence_percent: int
    genus: str | None = None
    family: str | None = None


class IdentifyResponse(BaseModel):
    candidates: list[CandidateOut]
    image_url: str
    # Opaque storage key. The client hands this back when saving the plant so the
    # photo carries over without the client ever constructing a path.
    image_key: str
    attribution: AttributionOut | None = None


class PlantCreate(BaseModel):
    scientific_name: str = ""
    nickname: str | None = None
    common_name: str | None = None
    image_key: str | None = None
    interval_days: int | None = None


class PlantUpdate(BaseModel):
    nickname: str | None = None
    interval_days: int | None = None
    clear_interval: bool = False


class PlantOut(BaseModel):
    id: int
    nickname: str | None
    scientific_name: str
    common_name: str | None
    image_url: str | None
    interval_days: int | None
    created_at: datetime

    @property
    def display_name(self) -> str:
        return self.nickname or self.common_name or self.scientific_name


class CareResponse(BaseModel):
    """Care facts, verbatim from the source.

    poisonous_to_pets / poisonous_to_humans are tri-state. null means the source
    did not say — clients must render that as "unknown", never as safe.
    """

    requested_name: str
    normalized_name: str
    match_kind: Literal["exact", "genus", "none"]
    matched_name: str | None = None
    common_name: str | None = None
    watering: str | None = None
    sunlight: list[str] = []
    cycle: str | None = None
    poisonous_to_pets: bool | None = None
    poisonous_to_humans: bool | None = None
    toxicity_known: bool = False
    from_cache: bool = False
