import time
from threading import Lock

_store: dict[str, tuple[float, object]] = {}
_lock = Lock()


def get(key: str):
    with _lock:
        entry = _store.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if time.time() > expires_at:
        with _lock:
            _store.pop(key, None)
        return None
    return value


def set(key: str, value, ttl_seconds: int):
    with _lock:
        _store[key] = (time.time() + ttl_seconds, value)
