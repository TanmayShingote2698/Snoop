"""
Snoop AI Monitor — Event Logger
================================
Provides a standardised way to create, buffer, and persist anomaly events.

Event format
------------
{
    "event_type": "phone_detected",
    "timestamp": "2026-03-11T13:30:00",
    "confidence": 0.92
}
"""

import json
import os
from datetime import datetime
from threading import Lock

# Path for the persistent JSON log (next to this file by default)
_LOG_DIR  = os.path.dirname(os.path.abspath(__file__))
_LOG_FILE = os.path.join(_LOG_DIR, "anomaly_log.json")


class EventLogger:
    """Thread-safe anomaly event logger."""

    def __init__(self, log_file: str = _LOG_FILE, max_buffer: int = 500):
        self._log_file  = log_file
        self._max_buffer = max_buffer
        self._events: list[dict] = []
        self._lock = Lock()

        # Ensure the log file exists with an empty array
        if not os.path.exists(self._log_file):
            with open(self._log_file, "w") as f:
                json.dump([], f)

    # ── public API ────────────────────────────────────────────────────

    def log_event(self, event_type: str, confidence: float = 1.0) -> dict:
        """Create an anomaly event, buffer it, and return the dict."""
        event = {
            "event_type": event_type,
            "timestamp":  datetime.now().isoformat(timespec="seconds"),
            "confidence": round(confidence, 4),
        }
        with self._lock:
            self._events.append(event)
            if len(self._events) > self._max_buffer:
                self._events = self._events[-self._max_buffer:]
        self._append_to_file(event)
        return event

    def get_recent_events(self, n: int = 10) -> list[dict]:
        """Return the last *n* events from the in-memory buffer."""
        with self._lock:
            return list(self._events[-n:])

    def get_all_events(self) -> list[dict]:
        """Return all buffered events."""
        with self._lock:
            return list(self._events)

    # ── internals ─────────────────────────────────────────────────────

    def _append_to_file(self, event: dict) -> None:
        """Append a single event to the JSON log on disk."""
        try:
            with open(self._log_file, "r") as f:
                data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            data = []

        data.append(event)

        with open(self._log_file, "w") as f:
            json.dump(data, f, indent=2)
