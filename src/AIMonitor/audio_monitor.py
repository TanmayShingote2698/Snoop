import time
import threading
import numpy as np

try:
    import pyaudio
except ImportError:
    pyaudio = None

try:
    import webrtcvad
except ImportError:
    webrtcvad = None


from config import (
    AUDIO_SAMPLE_RATE,
    AUDIO_CHUNK_SIZE,
    AUDIO_CHANNELS,
    AUDIO_ANOMALY_DURATION,
)


class AudioMonitor:

    def __init__(self):
        self._running = False
        self._thread = None
        self._lock = threading.Lock()

        self._current_status = "silence"
        self._pending_events = []

        self._anomaly_start = None

        # 🔥 adaptive system
        self._calibration_data = []
        self._calibrated = False
        self._calibration_duration = 3.0
        self._start_time = None

        # dynamic thresholds
        self.silence_th = 0.003
        self.whisper_th = 0.015
        self.speech_th = 0.045
        self.noise_th = 0.08

        # smoothing
        self._history = []
        self._history_size = 5

        self.vad = webrtcvad.Vad(2) if webrtcvad else None

    # ─────────────────────────────────────────────

    def start(self):
        if pyaudio is None:
            return

        self._running = True
        self._start_time = time.time()

        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join()

    def collect_events(self):
        with self._lock:
            events = list(self._pending_events)
            self._pending_events.clear()
        return events

    @property
    def status(self):
        with self._lock:
            return self._current_status

    # ─────────────────────────────────────────────

    def _capture_loop(self):
        pa = pyaudio.PyAudio()

        stream = pa.open(
            format=pyaudio.paInt16,
            channels=AUDIO_CHANNELS,
            rate=AUDIO_SAMPLE_RATE,
            input=True,
            frames_per_buffer=AUDIO_CHUNK_SIZE,
        )

        while self._running:
            try:
                raw = stream.read(AUDIO_CHUNK_SIZE, exception_on_overflow=False)

                samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
                samples /= 32768.0

                self._analyse_chunk(samples, raw)

            except Exception:
                continue

        stream.stop_stream()
        stream.close()
        pa.terminate()

    # ─────────────────────────────────────────────

    def _analyse_chunk(self, samples, raw):

        rms = float(np.sqrt(np.mean(samples ** 2)))

        # 🔥 CALIBRATION PHASE
        if not self._calibrated:
            self._calibration_data.append(rms)

            if time.time() - self._start_time > self._calibration_duration:
                self._set_dynamic_thresholds()
                self._calibrated = True

            return  # skip detection during calibration

        # 🔥 VAD (speech detection)
        is_speech = False
        if self.vad:
            try:
                is_speech = self.vad.is_speech(raw, AUDIO_SAMPLE_RATE)
            except:
                pass

        # ── classification ────────────────────────
        if rms < self.silence_th:
            status = "silence"

        elif is_speech:
            if rms < self.whisper_th:
                status = "whispering"
            elif rms < self.speech_th:
                status = "background_speech"
            else:
                status = "loud_speech"

        else:
            if rms > self.noise_th:
                status = "abnormal_noise"
            else:
                status = "ambient_noise"

        # 🔥 smoothing
        self._history.append(status)
        if len(self._history) > self._history_size:
            self._history.pop(0)

        status = max(set(self._history), key=self._history.count)

        with self._lock:
            self._current_status = status

        # ── anomaly detection ─────────────────────
        if status in ("background_speech", "whispering", "loud_speech"):

            if self._anomaly_start is None:
                self._anomaly_start = time.time()

            elif time.time() - self._anomaly_start > AUDIO_ANOMALY_DURATION:

                with self._lock:
                    self._pending_events.append({
                        "event_type": f"audio_{status}",
                        "confidence": round(min(rms / self.noise_th, 1.0), 4),
                    })

                self._anomaly_start = time.time()

        else:
            self._anomaly_start = None

    # ─────────────────────────────────────────────

    def _set_dynamic_thresholds(self):

        baseline = np.mean(self._calibration_data)

        # 🔥 adaptive thresholds
        self.silence_th = baseline * 1.2
        self.whisper_th = baseline * 3
        self.speech_th = baseline * 6
        self.noise_th = baseline * 10
