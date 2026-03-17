"""
Snoop AI Monitor — Audio Monitoring Module
============================================
Uses PyAudio to capture microphone input in a background thread and
Librosa to extract energy / MFCC features for simple speech detection.

Classifications:
    silence, whispering, background_speech, abnormal_noise

If speech or noise is detected continuously for AUDIO_ANOMALY_DURATION
seconds, an anomaly event is generated.
"""

import time
import threading
import numpy as np

try:
    import pyaudio
except ImportError:
    pyaudio = None          # graceful degradation if hardware missing

try:
    import librosa
except ImportError:
    librosa = None

from config import (
    AUDIO_SAMPLE_RATE,
    AUDIO_CHUNK_SIZE,
    AUDIO_CHANNELS,
    AUDIO_FORMAT_WIDTH,
    AUDIO_SILENCE_THRESHOLD,
    AUDIO_WHISPER_THRESHOLD,
    AUDIO_SPEECH_THRESHOLD,
    AUDIO_NOISE_THRESHOLD,
    AUDIO_ANOMALY_DURATION,
)


class AudioMonitor:
    """Runs in a background thread; exposes current status and events."""

    def __init__(self):
        self._running = False
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()

        self._current_status = "silence"
        self._pending_events: list[dict] = []

        # Anomaly timing
        self._anomaly_start: float | None = None

    # ── public API ────────────────────────────────────────────────────

    def start(self) -> None:
        """Begin capturing audio in a background thread."""
        if pyaudio is None:
            print("[AudioMonitor] PyAudio not installed — audio monitoring disabled.")
            return
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Signal the background thread to stop."""
        self._running = False
        if self._thread is not None:
            self._thread.join(timeout=3)

    @property
    def status(self) -> str:
        """Return the latest audio classification."""
        with self._lock:
            return self._current_status

    def collect_events(self) -> list[dict]:
        """Return and clear any pending anomaly events."""
        with self._lock:
            events = list(self._pending_events)
            self._pending_events.clear()
        return events

    # ── background capture ────────────────────────────────────────────

    def _capture_loop(self) -> None:
        pa = pyaudio.PyAudio()
        try:
            stream = pa.open(
                format=pyaudio.paInt16,
                channels=AUDIO_CHANNELS,
                rate=AUDIO_SAMPLE_RATE,
                input=True,
                frames_per_buffer=AUDIO_CHUNK_SIZE,
            )
        except OSError as exc:
            print(f"[AudioMonitor] Cannot open microphone: {exc}")
            self._running = False
            pa.terminate()
            return

        while self._running:
            try:
                raw = stream.read(AUDIO_CHUNK_SIZE, exception_on_overflow=False)
                samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
                samples /= 32768.0               # normalise to [-1, 1]
                self._analyse_chunk(samples)
            except Exception:
                continue

        stream.stop_stream()
        stream.close()
        pa.terminate()

    def _analyse_chunk(self, samples: np.ndarray) -> None:
        """Classify the audio chunk and manage anomaly timing."""
        rms = float(np.sqrt(np.mean(samples ** 2)))

        # ── simple energy-based classification ────────────────────────
        if rms < AUDIO_SILENCE_THRESHOLD:
            status = "silence"
        elif rms < AUDIO_WHISPER_THRESHOLD:
            status = "whispering"
        elif rms < AUDIO_SPEECH_THRESHOLD:
            status = "background_speech"
        else:
            status = "abnormal_noise"

        # Optional: Use MFCC features if librosa is available for
        # better classification (enriches the basic energy check)
        if librosa is not None and status != "silence":
            try:
                mfccs = librosa.feature.mfcc(
                    y=samples, sr=AUDIO_SAMPLE_RATE, n_mfcc=13
                )
                mfcc_energy = float(np.mean(np.abs(mfccs[1:])))
                # Refine: lower MFCC energy requirement makes it pick up whispering easier
                if mfcc_energy > 2.5 and rms >= AUDIO_SILENCE_THRESHOLD:
                    if rms < AUDIO_WHISPER_THRESHOLD:
                        status = "whispering"
                    elif rms < AUDIO_SPEECH_THRESHOLD:
                        status = "background_speech"
            except Exception:
                pass  # fall back to energy-only classification

        with self._lock:
            self._current_status = status

        # ── anomaly timer ─────────────────────────────────────────────
        if status in ("background_speech", "whispering", "abnormal_noise"):
            if self._anomaly_start is None:
                self._anomaly_start = time.time()
            elif time.time() - self._anomaly_start > AUDIO_ANOMALY_DURATION:
                with self._lock:
                    self._pending_events.append({
                        "event_type": f"audio_{status}",
                        "confidence": round(min(rms / AUDIO_NOISE_THRESHOLD, 1.0), 4),
                    })
                self._anomaly_start = time.time()     # reset
        else:
            self._anomaly_start = None
