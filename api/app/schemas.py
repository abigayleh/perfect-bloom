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
    attribution: AttributionOut | None = None


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
