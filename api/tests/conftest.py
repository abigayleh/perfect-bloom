import os

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.config import get_settings
from app.models import Base


@pytest.fixture(autouse=True, scope="session")
def test_settings():
    # No retry backoff in tests, and never a real provider.
    os.environ["HTTP_MAX_RETRIES"] = "0"
    os.environ["IDENTIFY_PROVIDER"] = "fake"
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
async def session():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, expire_on_commit=False)() as db:
        yield db
    await engine.dispose()


@pytest.fixture
async def client(session):
    """An HTTP client wired to the app, sharing the test's in-memory database."""
    from app.db import get_session
    from app.main import app

    app.dependency_overrides[get_session] = lambda: session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http_client:
        yield http_client
    app.dependency_overrides.clear()
