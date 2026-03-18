# """
# Snoop AI Monitor — Centralized Configuration
# =============================================
# All thresholds, model settings, class mappings, and display colors
# are defined here so every module draws from a single source of truth.
# """

# # ── YOLOv8 Object Detection ──────────────────────────────────────────
# YOLO_MODEL_PATH = "yolov8n.pt"          # auto-downloaded on first run
# YOLO_CONFIDENCE_THRESHOLD = 0.45

# # COCO class-ids we care about
# TARGET_CLASSES = {
#     0:  "person",
#     63: "laptop",
#     67: "cell phone",
#     73: "book",
# }

# # Objects that trigger an anomaly when detected
# SUSPICIOUS_OBJECTS = {"cell phone", "book", "laptop"}

# # ── Face Detection (MTCNN) ───────────────────────────────────────────
# MTCNN_MIN_FACE_SIZE = 40
# MTCNN_CONFIDENCE_THRESHOLD = 0.90

# # ── Gaze / Head-Pose Detection (MediaPipe) ───────────────────────────
# GAZE_AWAY_DURATION_THRESHOLD = 3.0      # seconds before anomaly fires

# # Ratios for iris-position classification
# GAZE_LEFT_THRESHOLD  = 0.35
# GAZE_RIGHT_THRESHOLD = 0.65
# GAZE_DOWN_THRESHOLD  = 0.65

# # Head-pose (nose-tip normalised position)
# HEAD_LEFT_THRESHOLD  = 0.40
# HEAD_RIGHT_THRESHOLD = 0.60
# HEAD_DOWN_THRESHOLD  = 0.65

# # ── Audio Monitoring ─────────────────────────────────────────────────
# AUDIO_SAMPLE_RATE    = 16_000
# AUDIO_CHUNK_SIZE     = 1024
# AUDIO_CHANNELS       = 1
# AUDIO_FORMAT_WIDTH   = 2                 # 16-bit (paInt16)

# # Energy thresholds (lowered for higher sensitivity to whispers/small noises)
# AUDIO_SILENCE_THRESHOLD   = 0.001     # very low baseline for absolute silence
# AUDIO_WHISPER_THRESHOLD   = 0.005     # tiny disturbances or whispering
# AUDIO_SPEECH_THRESHOLD    = 0.02      # normal talking
# AUDIO_NOISE_THRESHOLD     = 0.08      # loud noises

# # How long speech / noise must persist to fire an anomaly (seconds)
# AUDIO_ANOMALY_DURATION    = 2.0       # reduced from 4.0 so it alerts faster

# # ── Display / Overlay ────────────────────────────────────────────────
# FRAME_WIDTH  = 960
# FRAME_HEIGHT = 720

# # BGR colours
# COLOR_OBJECT_BOX   = (0, 255,  0)       # green
# COLOR_FACE_BOX     = (255, 200, 0)      # cyan-ish
# COLOR_GAZE_TEXT    = (255, 255, 0)       # yellow
# COLOR_ALERT        = (0,   0, 255)      # red
# COLOR_INFO_TEXT    = (255, 255, 255)     # white

"""
Snoop AI Monitor — Centralized Configuration
=============================================
Optimized thresholds for accurate AI invigilation.

All models read parameters from this file to maintain
consistent behaviour across the pipeline.
"""

# ─────────────────────────────────────────────────────────────
# YOLOv8 OBJECT DETECTION
# ─────────────────────────────────────────────────────────────

YOLO_MODEL_PATH = "yolov8m.pt"

YOLO_CONFIDENCE_THRESHOLD = 0.25
YOLO_IOU_THRESHOLD = 0.45

PERSON_CONFIDENCE_THRESHOLD = 0.45

MODEL_PROCESS_INTERVAL = 1
# Classes monitored from COCO
TARGET_CLASSES = {
    0:  "person",
    63: "laptop",
    67: "cell phone",
    73: "book"
}

# Objects considered cheating tools
SUSPICIOUS_OBJECTS = {
    "cell phone",
    "book",
    "laptop"
}

# Person monitoring

# ─────────────────────────────────────────────────────────────
# FACE DETECTION (MTCNN)
# ─────────────────────────────────────────────────────────────
MTCNN_CONFIDENCE_THRESHOLD = 0.90
MTCNN_MIN_FACE_SIZE = 80

# Face presence validation
NO_FACE_TIMEOUT = 2.5
MULTIPLE_FACE_TIMEOUT = 1.5


# ─────────────────────────────────────────────────────────────
# # ───── GAZE ─────
GAZE_AWAY_DURATION_THRESHOLD = 2.0   # faster detection

GAZE_LEFT_THRESHOLD  = 0.35
GAZE_RIGHT_THRESHOLD = 0.65
GAZE_DOWN_THRESHOLD  = 0.65

# ───── HEAD POSE ─────
HEAD_YAW_LEFT  = -15   # degrees
HEAD_YAW_RIGHT = 15
HEAD_PITCH_DOWN = 15

# ───── BLINK ─────
BLINK_RATIO_THRESHOLD = 0.18
MAX_BLINK_DURATION = 2.0

# ─────────────────────────────────────────────────────────────
# AUDIO MONITORING
# ─────────────────────────────────────────────────────────────

AUDIO_SAMPLE_RATE = 16000
AUDIO_CHUNK_SIZE = 480      
AUDIO_CHANNELS = 1
AUDIO_FORMAT_WIDTH = 2

# tuned thresholds
AUDIO_SILENCE_THRESHOLD = 0.003
AUDIO_WHISPER_THRESHOLD = 0.015
AUDIO_SPEECH_THRESHOLD  = 0.045
AUDIO_NOISE_THRESHOLD   = 0.08

#  better stability
AUDIO_ANOMALY_DURATION = 2.5


# ─────────────────────────────────────────────────────────────
# VIDEO / DISPLAY SETTINGS
# ─────────────────────────────────────────────────────────────

FRAME_WIDTH = 1280
FRAME_HEIGHT = 720
FRAME_FPS = 20


# ─────────────────────────────────────────────────────────────
# UI / OVERLAY COLORS (BGR)
# ─────────────────────────────────────────────────────────────

COLOR_OBJECT_BOX = {
    "HIGH": (0, 0, 255),      # Red → dangerous (phone)
    "MEDIUM": (0, 165, 255),  # Orange → suspicious (book/laptop)
    "LOW": (0, 255, 255),     # Yellow → weak signal
    "NORMAL": (0, 255, 0),    # Green → safe (person)
}
COLOR_FACE_BOX = (0, 255, 0)        # Green → normal face

# ───── GAZE ─────
COLOR_GAZE_TEXT = (255, 255, 255)   # White → readable

# ───── ALERT LEVELS ─────
COLOR_ALERT = (0, 0, 255)           #  Red → HIGH RISK
COLOR_WARNING = (0, 165, 255)       #  Orange → MEDIUM RISK
COLOR_INFO_TEXT = (200, 200, 200)   # Light gray → neutral


# ─────────────────────────────────────────────────────────────
# PERFORMANCE CONTROL
# ─────────────────────────────────────────────────────────────

# Run heavy models every N frames
MODEL_PROCESS_INTERVAL = 1

# Camera buffer reduction
CAMERA_BUFFER_SIZE = 1