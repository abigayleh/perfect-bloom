import uuid
from functools import lru_cache
from pathlib import Path
from typing import Protocol

import anyio

from app.config import get_settings

MEDIA_URL_PREFIX = "/media"


class Storage(Protocol):
    """Handlers get opaque keys from this; they never see or build a filesystem path."""

    async def save(self, data: bytes, ext: str = "jpg") -> str: ...

    def url(self, key: str) -> str: ...

    async def delete(self, key: str) -> None: ...


def _check_key(key: str) -> None:
    if not key or "/" in key or "\\" in key or ".." in key:
        raise ValueError(f"unsafe storage key: {key!r}")


class LocalDiskStorage:
    """Dev backend. Swapping in S3 means another class implementing Storage."""

    def __init__(self, root: Path) -> None:
        self._root = root

    def _write(self, key: str, data: bytes) -> None:
        self._root.mkdir(parents=True, exist_ok=True)
        (self._root / key).write_bytes(data)

    def _unlink(self, key: str) -> None:
        (self._root / key).unlink(missing_ok=True)

    async def save(self, data: bytes, ext: str = "jpg") -> str:
        key = f"{uuid.uuid4().hex}.{ext}"
        await anyio.to_thread.run_sync(self._write, key, data)
        return key

    def url(self, key: str) -> str:
        _check_key(key)
        return f"{MEDIA_URL_PREFIX}/{key}"

    async def delete(self, key: str) -> None:
        _check_key(key)
        await anyio.to_thread.run_sync(self._unlink, key)


@lru_cache
def get_storage() -> Storage:
    return LocalDiskStorage(get_settings().upload_dir)
