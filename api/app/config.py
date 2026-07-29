from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET_KEY = "dev-only-insecure-key-do-not-use-in-production"


class Settings(BaseSettings):
    """Every environment variable the app reads is declared here and nowhere else."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "dev"
    secret_key: str = DEV_SECRET_KEY
    database_url: str = "sqlite+aiosqlite:///./perfect_bloom.db"

    identify_provider: str = "fake"
    plantnet_api_key: str = ""
    plantnet_base_url: str = "https://my-api.plantnet.org/v2"

    care_provider: str = "fake"
    perenual_api_key: str = ""
    perenual_base_url: str = "https://perenual.com/api/v2"

    max_upload_bytes: int = 8 * 1024 * 1024
    max_upload_images: int = 5
    max_image_dimension: int = 2048

    # Proxied calls per device per day — the only thing between a stranger and the
    # PlantNet/Perenual bill.
    device_daily_call_limit: int = 100

    http_timeout_seconds: float = 10.0
    http_max_retries: int = 2

    @property
    def is_dev(self) -> bool:
        return self.env == "dev"

    @model_validator(mode="after")
    def check_production_secrets(self) -> "Settings":
        # An empty SECRET_KEY in .env would otherwise sign sessions with "".
        if not self.secret_key and self.is_dev:
            self.secret_key = DEV_SECRET_KEY
        if not self.is_dev and self.secret_key in ("", DEV_SECRET_KEY):
            raise ValueError("SECRET_KEY must be set to a real value outside dev")
        if self.identify_provider == "plantnet" and not self.plantnet_api_key:
            raise ValueError("PLANTNET_API_KEY is required when IDENTIFY_PROVIDER=plantnet")
        if self.care_provider == "perenual" and not self.perenual_api_key:
            raise ValueError("PERENUAL_API_KEY is required when CARE_PROVIDER=perenual")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
