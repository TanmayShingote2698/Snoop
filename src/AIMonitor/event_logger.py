# """
# Snoop AI Monitor — Event Logger
# ================================
# Provides a standardised way to create, buffer, and persist anomaly events.

# Event format
# ------------
# {
#     "event_type": "phone_detected",
#     "timestamp": "2026-03-11T13:30:00",
#     "confidence": 0.92
# }
# """

# import json
# import os
# from datetime import datetime
# from threading import Lock

# # Path for the persistent JSON log (next to this file by default)
# _LOG_DIR  = os.path.dirname(os.path.abspath(__file__))
# _LOG_FILE = os.path.join(_LOG_DIR, "anomaly_log.json")


# class EventLogger:
#     """Thread-safe anomaly event logger."""

#     def __init__(self, log_file: str = _LOG_FILE, max_buffer: int = 500):
#         self._log_file  = log_file
#         self._max_buffer = max_buffer
#         self._events: list[dict] = []
#         self._lock = Lock()

#         # Ensure the log file exists with an empty array
#         if not os.path.exists(self._log_file):
#             with open(self._log_file, "w") as f:
#                 json.dump([], f)

#     # ── public API ────────────────────────────────────────────────────

#     def log_event(self, event_type: str, confidence: float = 1.0) -> dict:
#         """Create an anomaly event, buffer it, and return the dict."""
#         event = {
#             "event_type": event_type,
#             "timestamp":  datetime.now().isoformat(timespec="seconds"),
#             "confidence": round(confidence, 4),
#         }
#         with self._lock:
#             self._events.append(event)
#             if len(self._events) > self._max_buffer:
#                 self._events = self._events[-self._max_buffer:]
#         self._append_to_file(event)
#         return event

#     def get_recent_events(self, n: int = 10) -> list[dict]:
#         """Return the last *n* events from the in-memory buffer."""
#         with self._lock:
#             return list(self._events[-n:])

#     def get_all_events(self) -> list[dict]:
#         """Return all buffered events."""
#         with self._lock:
#             return list(self._events)

#     # ── internals ─────────────────────────────────────────────────────

#     def _append_to_file(self, event: dict) -> None:
#         """Append a single event to the JSON log on disk."""
#         try:
#             with open(self._log_file, "r") as f:
#                 data = json.load(f)
#         except (json.JSONDecodeError, FileNotFoundError):
#             data = []

#         data.append(event)

#         with open(self._log_file, "w") as f:
#             json.dump(data, f, indent=2)

import json
import os
import time
from datetime import datetime
from threading import Lock


class EventLogger:
    """
    Advanced Event Logger with:
    ✔ Time-based buffering
    ✔ Session-based storage
    ✔ Batch writing
    ✔ Auto cleanup
    """

    def __init__(self, log_dir="logs", buffer_seconds=30, batch_size=20):
        self.log_dir = log_dir
        self.buffer_seconds = buffer_seconds
        self.batch_size = batch_size

        self._lock = Lock()

        # session_id -> list of events
        self._events = {}

        # temporary batch buffer
        self._batch_buffer = []

        os.makedirs(self.log_dir, exist_ok=True)

    # ─────────────────────────────────────────────

    def log_event(self, session_id, event_type, confidence=1.0, severity="medium"):

        event = {
            "event_type": event_type,
            "confidence": round(confidence, 4),
            "severity": severity,
            "timestamp": time.time()
        }

        with self._lock:

            # Initialize session
            if session_id not in self._events:
                self._events[session_id] = []

            # Add event
            self._events[session_id].append(event)

            #  Remove old events (time-based cleanup)
            self._cleanup_old_events(session_id)

            # Add to batch buffer
            self._batch_buffer.append((session_id, event))

            # Batch write
            if len(self._batch_buffer) >= self.batch_size:
                self._flush_to_disk()

        return event

    # ─────────────────────────────────────────────

    def _cleanup_old_events(self, session_id):

        current_time = time.time()

        self._events[session_id] = [
            e for e in self._events[session_id]
            if current_time - e["timestamp"] <= self.buffer_seconds
        ]

    # ─────────────────────────────────────────────

    def get_recent_events(self, session_id):

        with self._lock:
            return list(self._events.get(session_id, []))

    # ─────────────────────────────────────────────

    def get_events_last_n_seconds(self, session_id, seconds):

        current_time = time.time()

        with self._lock:
            return [
                e for e in self._events.get(session_id, [])
                if current_time - e["timestamp"] <= seconds
            ]

    # ─────────────────────────────────────────────

    def _flush_to_disk(self):

        # Group by session
        session_groups = {}

        for session_id, event in self._batch_buffer:
            session_groups.setdefault(session_id, []).append(event)

        for session_id, events in session_groups.items():

            file_path = os.path.join(self.log_dir, f"{session_id}.json")

            try:
                if os.path.exists(file_path):
                    with open(file_path, "r") as f:
                        data = json.load(f)
                else:
                    data = []
            except:
                data = []

            data.extend(events)

            with open(file_path, "w") as f:
                json.dump(data, f, indent=2)

        # Clear buffer
        self._batch_buffer.clear()

    # ─────────────────────────────────────────────

    def flush(self):
        """Force write remaining events to disk"""
        with self._lock:
            if self._batch_buffer:
                self._flush_to_disk()

    # ─────────────────────────────────────────────

    def clear_session(self, session_id):

        with self._lock:
            if session_id in self._events:
                del self._events[session_id]