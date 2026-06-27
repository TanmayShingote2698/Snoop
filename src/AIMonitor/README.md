# Snoop AI Monitor — Anomaly Detection Models & Evaluation Report

## Overview

The Snoop AI Monitor is a real-time exam proctoring system that uses **5 AI models running simultaneously** on a live camera feed to detect cheating and suspicious behavior during online examinations. Each model specializes in a different anomaly detection domain—face presence, eye/gaze tracking, prohibited object detection, audio analysis, and multi-modal cheat score fusion.

This document describes each model's algorithm, configuration, and the **live evaluation metrics** captured during real-time monitoring sessions.

---

## Model Architecture Summary

| # | Model | Algorithm / Framework | Input | Anomaly Types |
|---|---|---|---|---|
| 1 | **Face Detection** | MTCNN (facenet-pytorch) + PyTorch | Webcam Frame (BGR) | No face, Multiple faces |
| 2 | **Gaze Detection** | MediaPipe FaceMesh + Head Pose Estimation (PnP Solver) | Webcam Frame (BGR) | Looking left/right/down, Eyes closed, Talking |
| 3 | **Object Detection** | YOLOv8m (Ultralytics) | Webcam Frame (BGR) | Cell phone, Book, Laptop, Multiple persons |
| 4 | **Audio Monitor** | PyAudio + WebRTC VAD + Adaptive RMS Analysis | Microphone Stream (16kHz) | Whispering, Background speech, Loud speech, Abnormal noise |
| 5 | **Cheat Score Calculator** | Multi-Modal Fusion Engine (Weighted + Rule-based) | All model events | Risk classification (LOW → CRITICAL) |

---

## 1. Face Detection Model

### Algorithm: MTCNN (Multi-task Cascaded Convolutional Networks)

MTCNN is a deep learning face detection framework that uses a cascade of three neural networks (P-Net, R-Net, O-Net) to detect faces with bounding boxes and facial landmarks.

**Pipeline:**

```
Frame → BGR→RGB → MTCNN Detect → Filter by Confidence → Area Filter → Stability Smoothing → Status
```

### Configuration

| Parameter | Value | Description |
|---|---|---|
| Framework | `facenet-pytorch` (MTCNN) | PyTorch-based MTCNN implementation |
| Device | Auto (CUDA if available, else CPU) | Automatic GPU/CPU selection |
| Min Face Size | `80 px` | Minimum detectable face size |
| Confidence Threshold | `0.90` (90%) | Minimum confidence to consider a valid face |
| Min Face Area | `1500 px²` | Faces smaller than this are filtered as noise |
| Stability Window | `5 frames` | Temporal smoothing over last 5 frames |
| Event Cooldown | `2 seconds` | Minimum gap between repeated event triggers |

### Anomaly Classification

| Face Status | Classification | Severity |
|---|---|---|
| `no_face` | **ANOMALY** — Student absent or obscured | High |
| `multiple_faces` | **ANOMALY** — Unauthorized person present | High |
| `normal_face` | **NORMAL** — Single face detected | — |

### How Accuracy is Measured

- **Anomaly Rate** = Frames with anomaly / Total frames × 100
- **Detection Accuracy** = Successfully processed frames / Total frames × 100
- **Avg Confidence** = Average MTCNN confidence score across all anomaly detections

---

## 2. Gaze Detection Model

### Algorithm: MediaPipe FaceMesh + Iris Tracking + Head Pose Estimation

Uses Google's MediaPipe FaceMesh (468 facial landmarks + 10 iris landmarks) combined with a head pose estimation algorithm using OpenCV's `solvePnP` (Perspective-n-Point) to determine where the student is looking.

**Pipeline:**

```
Frame → FaceMesh (468 landmarks) → Iris Ratio Calculation → Head Pose (PnP) → Gaze Fusion → Timer → Events
```

### Sub-Algorithms

| Component | Algorithm | Description |
|---|---|---|
| Face Landmarks | MediaPipe FaceMesh | 468 3D facial landmarks at 30+ FPS |
| Iris Tracking | Iris position ratio | `(iris_x - eye_left) / (eye_right - eye_left)` for horizontal gaze |
| Head Pose | OpenCV `solvePnP` + `RQDecomp3x3` | Estimates pitch/yaw from 6 facial points vs 3D model |
| Blink Detection | Eye Aspect Ratio (EAR) | `height / width` of eye landmarks; blink if EAR < 0.18 |
| Mouth/Talking | Mouth Aspect Ratio (MAR) | `height / width` of lip landmarks; talking if MAR > 0.35 |
| Smoothing | Majority voting | Most common status in last 5 frames |

### Configuration

| Parameter | Value | Description |
|---|---|---|
| Framework | MediaPipe FaceMesh | Google's real-time face landmark detection |
| Max Faces | `1` | Tracks single face |
| Detection Confidence | `0.6` | Minimum detection confidence |
| Tracking Confidence | `0.6` | Minimum tracking confidence |
| Gaze Away Duration | `2.0 seconds` | Time before gaze anomaly fires |
| Iris Left Threshold | `0.35` | Below this = looking left |
| Iris Right Threshold | `0.65` | Above this = looking right |
| Head Yaw Left | `-15°` | Head turned left |
| Head Yaw Right | `+15°` | Head turned right |
| Head Pitch Down | `+15°` | Head looking down |
| Blink EAR Threshold | `0.18` | Eye closed if EAR below this |
| Blink Duration | `2.0 seconds` | Long blink event trigger |
| Mouth MAR Threshold | `0.35` | Talking if MAR above this |
| Smoothing Window | `5 frames` | Temporal stability filter |

### Anomaly Classification

| Gaze Status | Classification | Severity |
|---|---|---|
| `looking_left` | **ANOMALY** — Eyes/head shifted left | Medium |
| `looking_right` | **ANOMALY** — Eyes/head shifted right | Medium |
| `looking_down` | **ANOMALY** — Eyes/head shifted down | Medium |
| `eyes_closed_long` | **ANOMALY** — Prolonged blink (>2s) | Low |
| `talking_detected` | **ANOMALY** — Mouth movement detected | Medium |
| `looking_at_screen` | **NORMAL** — Student focused | — |

### How Accuracy is Measured

- **Anomaly Rate** = Frames where gaze is NOT at screen / Total frames × 100
- **Detection Accuracy** = Frames processed without error / Total frames × 100
- **Avg Confidence** = Average confidence of gaze anomaly events

---

## 3. Object Detection Model

### Algorithm: YOLOv8m (You Only Look Once v8 Medium)

Uses Ultralytics YOLOv8m pre-trained on the COCO dataset (80 classes) to detect prohibited objects in the exam environment. Implements class-specific confidence thresholds, temporal stability filtering, and event cooldown.

**Pipeline:**

```
Frame → Resize (1280×720) → YOLOv8m Inference → Class Filter → Conf Filter → Area Filter → Stability Check → Events
```

### Configuration

| Parameter | Value | Description |
|---|---|---|
| Model | `yolov8m.pt` | YOLOv8 Medium (~52MB, 25.9M params) |
| Base Confidence | `0.25` | Minimum detection confidence |
| IOU Threshold | `0.45` | Non-max suppression overlap threshold |
| Person Confidence | `0.45` | Higher threshold for person detection |
| Input Resolution | `1280 × 720` | Frame resize for inference |
| Stability Threshold | `3 frames` | Object must appear in 3+ frames |
| Event Cooldown | `3 seconds` | Minimum gap between same-object events |
| Min Object Area | `600 px²` | Ignore detections smaller than this |

### Class-Specific Thresholds

| Object Class | COCO ID | Confidence Threshold | Severity | Classification |
|---|---|---|---|---|
| `cell phone` | 67 | `0.20` (20%) | **HIGH** | Prohibited device |
| `book` | 73 | `0.25` (25%) | **MEDIUM** | Possible cheat material |
| `laptop` | 63 | `0.30` (30%) | **MEDIUM** | Unauthorized device |
| `person` | 0 | `0.45` (45%) | **HIGH** (if >1) | Multiple persons = impersonation |

### Anomaly Classification

| Detection | Classification | Severity |
|---|---|---|
| `cell_phone_detected` | **ANOMALY** — Prohibited device | High |
| `book_detected` | **ANOMALY** — Cheat material | High |
| `laptop_detected` | **ANOMALY** — Unauthorized device | High |
| `multiple_persons_detected` | **ANOMALY** — More than 1 person | High |
| No suspicious objects | **NORMAL** | — |

### How Accuracy is Measured

- **Anomaly Rate** = Frames with suspicious object or multiple persons / Total frames × 100
- **Detection Accuracy** = Frames processed without error / Total frames × 100
- **Avg Confidence** = Average YOLOv8 confidence across all suspicious object detections

---

## 4. Audio Monitor Model

### Algorithm: PyAudio + WebRTC VAD + Adaptive RMS Classification

Captures microphone audio in a background thread and classifies it using a combination of RMS (Root Mean Square) energy analysis and WebRTC Voice Activity Detection (VAD). Features adaptive calibration that auto-tunes thresholds based on the ambient noise level during the first 3 seconds.

**Pipeline:**

```
Mic → PyAudio (16kHz, 16-bit) → RMS Energy → Calibration Phase (3s) → Adaptive Thresholds → VAD + Classification → Smoothing → Events
```

### Configuration

| Parameter | Value | Description |
|---|---|---|
| Sample Rate | `16,000 Hz` | Audio capture rate |
| Chunk Size | `480 samples` | Frames per buffer (~30ms) |
| Channels | `1` (Mono) | Single channel capture |
| Format | `16-bit int (paInt16)` | Audio sample format |
| VAD Aggressiveness | `2` (Medium) | WebRTC VAD sensitivity (0-3) |
| Calibration Duration | `3.0 seconds` | Ambient noise learning period |
| Anomaly Duration | `2.5 seconds` | Sustained speech before event fires |
| Smoothing Window | `5 chunks` | Majority voting over last 5 chunks |

### Adaptive Thresholds (Auto-Calibrated)

| Classification | Threshold Formula | Description |
|---|---|---|
| `silence` | `baseline × 1.2` | Below ambient noise floor |
| `whispering` | `baseline × 3` | Slight disturbance |
| `background_speech` | `baseline × 6` | Normal talking volume |
| `loud_speech` | `baseline × 10` | Raised voice |
| `abnormal_noise` | `> baseline × 10` (no VAD) | Loud non-speech noise |
| `ambient_noise` | Between silence and noise | Normal environment |

### Anomaly Classification

| Audio Status | Classification | Severity |
|---|---|---|
| `whispering` | **ANOMALY** — Possible whispered communication | Medium |
| `background_speech` | **ANOMALY** — Someone talking near student | Medium |
| `loud_speech` | **ANOMALY** — Loud conversation detected | High |
| `abnormal_noise` | **ANOMALY** — Suspicious loud noise | Medium |
| `silence` | **NORMAL** | — |
| `ambient_noise` | **NORMAL** | — |

### How Accuracy is Measured

- **Anomaly Rate** = Frames with speech/noise detected / Total frames × 100
- **Detection Accuracy** = Frames processed without error / Total frames × 100
- **Avg Confidence** = Average RMS-normalized confidence of speech events

---

## 5. Cheat Score Calculator (Fusion Engine)

### Algorithm: Multi-Modal Weighted Fusion with Rule-Based Boosting

Combines events from ALL other models into a single cheat score (0–100) using weighted scoring, frequency scaling, and fusion intelligence rules. Only considers events from the last N seconds (time-windowed).

**Pipeline:**

```
All Model Events → Time Window Filter (last 10s) → Count & Confidence → Base Score → Frequency Scaling → Fusion Rules → Behavior Score → Final Score → Risk Level
```

### Event Weights

| Event Type | Base Weight | Source Model |
|---|---|---|
| `phone_detected` | **25** | Object Detection |
| `multiple_persons_detected` | **20** | Object Detection |
| `no_face_detected` | **15** | Face Detection |
| `laptop_detected` | **10** | Object Detection |
| `talking_detected` | **10** | Gaze Detection |
| `book_detected` | **8** | Object Detection |
| `gaze_looking_down` | **6** | Gaze Detection |
| `gaze_looking_left` | **4** | Gaze Detection |
| `gaze_looking_right` | **4** | Gaze Detection |

### Fusion Intelligence Rules

When **multiple anomaly types co-occur**, bonus scores are applied to capture high-risk multi-modal patterns:

| Combination | Bonus Score | Rationale |
|---|---|---|
| Phone + Looking Down | **+30** | Using phone under desk |
| Multiple Persons + Talking | **+25** | Active communication with helper |
| No Face + Phone | **+20** | Hiding face to use phone |
| Talking + Looking Left | **+15** | Talking to person on the left |
| Talking + Looking Right | **+15** | Talking to person on the right |

### Scoring Formula

```
Base Score    = Σ (weight × avg_confidence × min(count/3, 2))    per event type
Fusion Score  = Σ (bonus)                                        per co-occurring rule
Behavior Score = tab_switches × 5 + fullscreen_exits × 10 + prohibited_keys × 6
─────────────────────────────────────────────────────────────────────────────────────
Final Score   = min(Base + Fusion + Behavior, 100)
```

### Risk Classification

| Score Range | Risk Level | Action |
|---|---|---|
| 0 – 19 | **LOW** | No concern |
| 20 – 39 | **MODERATE** | Minor flags observed |
| 40 – 59 | **MEDIUM** | Needs review |
| 60 – 79 | **HIGH** | Strong cheating indicators |
| 80 – 100 | **CRITICAL** | Clear cheating detected |

### How Accuracy is Measured

- **Anomaly Rate** = Frames with cheat score ≥ 20 / Total frames × 100
- **Detection Accuracy** = Frames processed without error / Total frames × 100
- **Avg Confidence** = Average cheat score as a percentage (score / 100)

---

## Live Evaluation Results

### Evaluation Setup

| Parameter | Value |
|---|---|
| **Evaluation Method** | Live webcam monitoring (all models simultaneous) |
| **Session Duration** | 30 seconds |
| **Total Frames Processed** | 52 |
| **Average FPS** | ~1.7 (limited by YOLOv8 inference) |
| **Camera Resolution** | 1280 × 720 |
| **Hardware** | CPU-based inference (Intel) |
| **Command** | `python evaluator.py --timeout 30` |

### Per-Model Accuracy & Performance

| Model | Frames | Anomaly Frames | Anomaly Rate | Detection Accuracy | Avg Confidence | Total Events | Avg Latency | Errors |
|---|---|---|---|---|---|---|---|---|
| **Face Detection** | 52 | 10 | **19.23%** | 100.00% | 100.00% | 3 | 50.0 ms | 0 |
| **Gaze Detection** | 52 | 0 | **0.00%** | 100.00% | — | 0 | 6.5 ms | 0 |
| **Object Detection** | 52 | 7 | **13.46%** | 100.00% | 93.41% | 7 | 489.1 ms | 0 |
| **Audio Monitor** | 52 | 15 | **28.85%** | 100.00% | — | 0 | 0.0 ms | 0 |
| **Cheat Score** | 52 | 8 | **15.38%** | 100.00% | 24.47% | 8 | 0.0 ms | 0 |

### Metrics Explanation

| Metric | Description |
|---|---|
| **Frames** | Total number of camera frames processed by this model |
| **Anomaly Frames** | Number of frames where the model detected an anomaly |
| **Anomaly Rate** | Percentage of frames flagged as anomalous (`anomaly_frames / total_frames × 100`) |
| **Detection Accuracy** | Percentage of frames processed without errors (`(total - errors) / total × 100`). 100% means the model never crashed |
| **Avg Confidence** | Average detection confidence score across all anomaly events (from model output). Higher = more certain detections |
| **Total Events** | Number of discrete anomaly events fired (after cooldown/stability filters). Lower than anomaly frames because events are rate-limited |
| **Avg Latency** | Average inference time per frame in milliseconds. Lower = faster model |
| **Errors** | Number of frames where the model threw an exception |

### Event Breakdown

| Model | Event Type | Count | Description |
|---|---|---|---|
| **Face Detection** | `no_face_detected` | 3 | Student's face was not visible |
| **Object Detection** | `multiple_persons_detected` | 6 | More than one person in frame |
| **Object Detection** | `book_detected` | 1 | Book visible near student |
| **Cheat Score** | `cheat_score_MODERATE` | 8 | Fusion score reached MODERATE risk |

### Model Latency Comparison

```
Face Detection   ████████████░░░░░░░░░░░░░░░░░░   50.0 ms
Gaze Detection   ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░    6.5 ms   (FASTEST)
Object Detection ████████████████████████████████  489.1 ms   (HEAVIEST)
Audio Monitor    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    0.0 ms   (Background thread)
Cheat Score      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    0.0 ms   (Lightweight fusion)
```

---

## How to Run the Evaluator

### Basic Usage

```bash
# Navigate to the AIMonitor directory
cd src/AIMonitor

# Run until you press 'q'
python evaluator.py

# Auto-stop after 60 seconds
python evaluator.py --timeout 60

# Run without display window (headless)
python evaluator.py --timeout 30 --no-display
```

### What Happens During Evaluation

1. All 5 models are initialized and loaded
2. The webcam opens and starts capturing frames
3. **Every frame** is processed by Face, Gaze, Object, and Audio models simultaneously
4. A live HUD overlay shows real-time anomaly counts per model
5. Alert banners flash when anomalies are detected
6. When you press `q` (or timeout is reached), the session ends
7. A full evaluation report is printed to the console
8. Results are saved to `evaluation_results.csv`

### Output Files

| File | Description |
|---|---|
| `evaluation_results.csv` | Per-model metrics in CSV format |
| Console output | Full table + event breakdown |

---

## Dependencies

| Package | Version | Used By |
|---|---|---|
| `opencv-python` | 4.x | All visual models, frame capture |
| `numpy` | 1.x | All models (array processing) |
| `torch` / `facenet-pytorch` | 2.x | Face Detection (MTCNN) |
| `ultralytics` | 8.x | Object Detection (YOLOv8m) |
| `mediapipe` | 0.10.x | Gaze Detection (FaceMesh) |
| `pyaudio` | 0.2.x | Audio Monitor (microphone capture) |
| `webrtcvad` | 2.x | Audio Monitor (voice activity detection) |

---

## File Structure

```
src/AIMonitor/
├── config.py                  # Centralized thresholds & settings
├── face_detection.py          # MTCNN face detection model
├── gaze_detection.py          # MediaPipe gaze + head pose model
├── object_detection.py        # YOLOv8m object detection model
├── audio_monitor.py           # Audio monitoring (background thread)
├── cheat_score_calculator.py  # Multi-modal fusion engine
├── monitoring_pipeline.py     # Main live monitoring pipeline
├── monitoring_service.py      # Flask API service wrapper
├── event_logger.py            # Event logging & persistence
├── evaluator.py               # MODEL EVALUATOR (this tool)
├── evaluation_results.csv     # Output: evaluation metrics
├── server.py                  # Flask server entry point
├── yolov8m.pt                 # YOLOv8m pre-trained weights (~52MB)
└── README.md                  # This documentation
```
