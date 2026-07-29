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
