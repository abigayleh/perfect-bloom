import asyncio
import logging

import httpx

from app.config import get_settings

log = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None

RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})


def get_client() -> httpx.AsyncClient:
    """One shared client for all outbound calls; closed on app shutdown."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=get_settings().http_timeout_seconds)
    return _client


async def aclose_client() -> None:
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None


async def request_with_retry(
    method: str,
    url: str,
    *,
    retries: int | None = None,
    **kwargs,
) -> httpx.Response:
    """Retries transport failures and retryable statuses with linear backoff.

    Raises the last httpx exception if every attempt fails. Non-retryable status
    codes are returned as-is for the caller to interpret.
    """
    settings = get_settings()
    attempts = (retries if retries is not None else settings.http_max_retries) + 1
    client = get_client()

    for attempt in range(attempts):
        is_last = attempt == attempts - 1
        try:
            response = await client.request(method, url, **kwargs)
            if response.status_code not in RETRY_STATUSES or is_last:
                return response
            log.warning("retryable status %s from %s", response.status_code, url)
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            log.warning("request to %s failed: %s", url, exc)
            if is_last:
                raise
        await asyncio.sleep(0.5 * (attempt + 1))

    raise RuntimeError("unreachable: retry loop always returns or raises")
