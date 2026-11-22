"""A small in-process sliding-window rate limiter."""

import threading
import time
from collections import deque
from datetime import timedelta


class SlidingWindow:
    def __init__(self, limit: int, window: timedelta):
        self.limit = limit
        self.window = window.total_seconds()
        self._hits: dict = {}
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    def _recent(self, key, now: float):
        """The key's hits inside the window, or None (and the key forgotten) when there are none."""
        hits = self._hits.get(key)
        if hits is None:
            return None
        while hits and now - hits[0] >= self.window:
            hits.popleft()
        if not hits:
            del self._hits[key]
            return None
        return hits

    def _sweep(self, now: float) -> None:
        """Forget keys with no recent hits, at most once per window, so keys never touched
        again (one-off usernames, say) don't pile up."""
        if now - self._last_sweep < self.window:
            return
        self._last_sweep = now
        for key in list(self._hits):
            self._recent(key, now)

    def hit(self, key) -> bool:
        """Record an attempt. False when the key is over its limit."""
        now = time.monotonic()
        with self._lock:
            self._sweep(now)
            hits = self._recent(key, now)
            if hits is not None and len(hits) >= self.limit:
                return False
            self._hits.setdefault(key, deque()).append(now)
            return True

    def full(self, key) -> bool:
        """True when the key is over its limit. Records nothing."""
        now = time.monotonic()
        with self._lock:
            hits = self._recent(key, now)
            return hits is not None and len(hits) >= self.limit

    def forget(self, key) -> None:
        """Drop the key's hits, as if it had never been seen."""
        with self._lock:
            self._hits.pop(key, None)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


# Sign-in failures: 10 per 15 minutes per username or email (failures only).
login_failures = SlidingWindow(10, timedelta(minutes=15))

# Passkey sign-ins that did not check out: 50 per 15 minutes across everyone
# (a passkey names no account until it is verified).
passkey_failures = SlidingWindow(50, timedelta(minutes=15))

# Wrong passwords when adding a passkey: 5 per 15 minutes per user.
password_checks = SlidingWindow(5, timedelta(minutes=15))
