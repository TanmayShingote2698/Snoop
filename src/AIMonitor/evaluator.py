#!/usr/bin/env python3
"""
Snoop AI Monitor -- Live Anomaly Detection Evaluator
=====================================================

Runs ALL anomaly detection models simultaneously on a live camera feed.
When you press 'q' to quit, it prints a full accuracy/performance report
for every model.

Usage:
    python evaluator.py
    python evaluator.py --timeout 60
    python evaluator.py --no-display

Author: Snoop AI Team
"""

import os
import sys
import csv
import time
import argparse
import traceback
import numpy as np
import cv2

# Ensure AIMonitor package is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import (
    FRAME_WIDTH,
    FRAME_HEIGHT,
    COLOR_ALERT,
    COLOR_INFO_TEXT,
)
from object_detection import ObjectDetector
from face_detection import FaceDetector
from gaze_detection import GazeDetector
from audio_monitor import AudioMonitor
from cheat_score_calculator import CheatScoreCalculator

# ---------------------------------------------------------------------------
# Output paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_CSV = os.path.join(SCRIPT_DIR, "evaluation_results.csv")


# ═══════════════════════════════════════════════════════════════════════════
# Model Tracker -- keeps per-model stats during the live session
# ═══════════════════════════════════════════════════════════════════════════

class ModelTracker:
    """Track per-frame anomaly detection statistics for a single model."""

    def __init__(self, name: str):
        self.name = name
        self.total_frames = 0
        self.anomaly_frames = 0
        self.normal_frames = 0
        self.total_events = 0
        self.confidence_sum = 0.0
        self.confidence_count = 0
        self.event_types = {}          # event_type -> count
        self.execution_times = []      # per-frame times in seconds
        self.errors = 0

    # ── Record one frame ──────────────────────────────────────────

    def record_frame(self, is_anomaly: bool, events: list, exec_time: float):
        """Record the result of one frame for this model."""
        self.total_frames += 1

        if is_anomaly:
            self.anomaly_frames += 1
        else:
            self.normal_frames += 1

        for ev in events:
            self.total_events += 1
            etype = ev.get("event_type", "unknown")
            self.event_types[etype] = self.event_types.get(etype, 0) + 1

            conf = ev.get("confidence", 1.0)
            self.confidence_sum += conf
            self.confidence_count += 1

        self.execution_times.append(exec_time)

    def record_error(self):
        """Record a frame where the model failed."""
        self.total_frames += 1
        self.errors += 1

    # ── Compute final metrics ─────────────────────────────────────

    def get_metrics(self) -> dict:
        """Compute final metrics after the session ends."""
        if self.total_frames == 0:
            return {
                "name": self.name,
                "total_frames": 0,
                "anomaly_frames": 0,
                "normal_frames": 0,
                "anomaly_rate": 0.0,
                "detection_accuracy": 0.0,
                "avg_confidence": 0.0,
                "total_events": 0,
                "avg_time_ms": 0.0,
                "errors": 0,
                "event_breakdown": {},
            }

        valid_frames = self.total_frames - self.errors
        anomaly_rate = (self.anomaly_frames / valid_frames * 100) if valid_frames > 0 else 0.0

        # Detection accuracy = how consistently the model produces
        # a clear verdict (not erroring out)
        detection_accuracy = (valid_frames / self.total_frames * 100) if self.total_frames > 0 else 0.0

        avg_conf = (self.confidence_sum / self.confidence_count) if self.confidence_count > 0 else 0.0
        avg_time = (sum(self.execution_times) / len(self.execution_times) * 1000) if self.execution_times else 0.0

        return {
            "name": self.name,
            "total_frames": self.total_frames,
            "anomaly_frames": self.anomaly_frames,
            "normal_frames": self.normal_frames,
            "anomaly_rate": round(anomaly_rate, 2),
            "detection_accuracy": round(detection_accuracy, 2),
            "avg_confidence": round(avg_conf * 100, 2),
            "total_events": self.total_events,
            "avg_time_ms": round(avg_time, 2),
            "errors": self.errors,
            "event_breakdown": dict(self.event_types),
        }


# ═══════════════════════════════════════════════════════════════════════════
# HUD Drawing Helpers
# ═══════════════════════════════════════════════════════════════════════════

def draw_alert_banner(frame, text: str, y_offset: int = 0):
    """Draw a translucent red alert banner on the frame."""
    h, w = frame.shape[:2]
    overlay = frame.copy()
    y = 50 + y_offset
    cv2.rectangle(overlay, (0, y), (w, y + 36), COLOR_ALERT, -1)
    cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)
    cv2.putText(frame, text, (12, y + 26),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)


def draw_status_bar(frame, face_status: str, gaze_status: str, audio_status: str):
    """Draw the live status bar at the bottom of the frame."""
    h, w = frame.shape[:2]
    cv2.rectangle(frame, (0, h - 40), (w, h), (30, 30, 30), -1)
    info = (f"Face: {face_status}  |  "
            f"Gaze: {gaze_status.replace('_', ' ').title()}  |  "
            f"Audio: {audio_status.replace('_', ' ').title()}")
    cv2.putText(frame, info, (12, h - 12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, COLOR_INFO_TEXT, 1)


def draw_live_stats(frame, trackers: dict, fps: float):
    """Draw live per-model anomaly counts on the top-left corner."""
    h, w = frame.shape[:2]

    # Semi-transparent background
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (360, 48 + len(trackers) * 22), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

    y = 18
    cv2.putText(frame, f"LIVE EVALUATION | FPS: {fps:.1f}", (8, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
    y += 8

    for name, tracker in trackers.items():
        y += 22
        anomalies = tracker.anomaly_frames
        total = tracker.total_frames
        rate = (anomalies / total * 100) if total > 0 else 0

        color = (0, 255, 0) if rate < 10 else (0, 165, 255) if rate < 30 else (0, 0, 255)
        cv2.putText(frame, f"{name}: {anomalies}/{total} ({rate:.1f}%)", (10, y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)


# ═══════════════════════════════════════════════════════════════════════════
# Results Display & Export
# ═══════════════════════════════════════════════════════════════════════════

def print_results_table(all_metrics: list):
    """Print a detailed results table to console after evaluation ends."""

    print("\n")
    print("=" * 96)
    print("     SNOOP AI MONITOR -- MODEL EVALUATION REPORT")
    print("=" * 96)

    # ── Main table ────────────────────────────────────────────────
    header = (
        f"{'Model':<25} | {'Frames':>7} | {'Anomalies':>9} | {'Anom Rate':>9} | "
        f"{'Accuracy':>9} | {'Avg Conf':>9} | {'Events':>7} | {'Avg ms':>8} | {'Errors':>6}"
    )
    sep = "-" * len(header)

    print(sep)
    print(header)
    print(sep)

    for m in all_metrics:
        row = (
            f"{m['name']:<25} | "
            f"{m['total_frames']:>7} | "
            f"{m['anomaly_frames']:>9} | "
            f"{m['anomaly_rate']:>8.2f}% | "
            f"{m['detection_accuracy']:>8.2f}% | "
            f"{m['avg_confidence']:>8.2f}% | "
            f"{m['total_events']:>7} | "
            f"{m['avg_time_ms']:>7.1f} | "
            f"{m['errors']:>6}"
        )
        print(row)

    print(sep)

    # ── Event breakdown per model ─────────────────────────────────
    print("\n\n--- EVENT BREAKDOWN ---\n")

    for m in all_metrics:
        if m["event_breakdown"]:
            print(f"  [{m['name']}]")
            for etype, count in sorted(m["event_breakdown"].items(), key=lambda x: -x[1]):
                print(f"    {etype:<35} : {count} events")
            print()

    print("=" * 96)


def save_results_csv(all_metrics: list, output_path: str = OUTPUT_CSV):
    """Save evaluation results to CSV."""
    fieldnames = [
        "model", "total_frames", "anomaly_frames", "normal_frames",
        "anomaly_rate_pct", "detection_accuracy_pct", "avg_confidence_pct",
        "total_events", "avg_time_ms", "errors",
    ]

    try:
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for m in all_metrics:
                writer.writerow({
                    "model": m["name"],
                    "total_frames": m["total_frames"],
                    "anomaly_frames": m["anomaly_frames"],
                    "normal_frames": m["normal_frames"],
                    "anomaly_rate_pct": m["anomaly_rate"],
                    "detection_accuracy_pct": m["detection_accuracy"],
                    "avg_confidence_pct": m["avg_confidence"],
                    "total_events": m["total_events"],
                    "avg_time_ms": m["avg_time_ms"],
                    "errors": m["errors"],
                })

        print(f"\n[SAVED] Results written to: {output_path}")
    except Exception as e:
        print(f"\n[ERROR] Failed to save CSV: {e}")


# ═══════════════════════════════════════════════════════════════════════════
# Main Evaluation Pipeline (Live Camera)
# ═══════════════════════════════════════════════════════════════════════════

def run_live_evaluation(timeout: int = 0, show_display: bool = True):
    """
    Run all anomaly detection models simultaneously on the live camera feed.

    Each frame is processed by:
        1. ObjectDetector  (YOLOv8)
        2. FaceDetector    (MTCNN)
        3. GazeDetector    (MediaPipe)
        4. AudioMonitor    (PyAudio + WebRTC VAD, background thread)
        5. CheatScoreCalculator (fusion engine)

    Press 'q' to stop. After stopping, a full per-model accuracy report
    is printed and saved to CSV.

    Args:
        timeout: Auto-stop after N seconds (0 = run until 'q')
        show_display: Show the live camera window
    """

    print("[Evaluator] Initializing all models...")

    # ── Initialize models ─────────────────────────────────────────
    try:
        obj_det = ObjectDetector()
        print("  [OK] ObjectDetector loaded (YOLOv8)")
    except Exception as e:
        print(f"  [FAIL] ObjectDetector: {e}")
        obj_det = None

    try:
        face_det = FaceDetector()
        print("  [OK] FaceDetector loaded (MTCNN)")
    except Exception as e:
        print(f"  [FAIL] FaceDetector: {e}")
        face_det = None

    try:
        gaze_det = GazeDetector()
        print("  [OK] GazeDetector loaded (MediaPipe)")
    except Exception as e:
        print(f"  [FAIL] GazeDetector: {e}")
        gaze_det = None

    try:
        audio = AudioMonitor()
        print("  [OK] AudioMonitor loaded")
    except Exception as e:
        print(f"  [FAIL] AudioMonitor: {e}")
        audio = None

    try:
        cheat_calc = CheatScoreCalculator(time_window=10)
        print("  [OK] CheatScoreCalculator loaded")
    except Exception as e:
        print(f"  [FAIL] CheatScoreCalculator: {e}")
        cheat_calc = None

    # ── Initialize trackers ───────────────────────────────────────
    trackers = {
        "Face Detection": ModelTracker("Face Detection"),
        "Gaze Detection": ModelTracker("Gaze Detection"),
        "Object Detection": ModelTracker("Object Detection"),
        "Audio Monitor": ModelTracker("Audio Monitor"),
        "Cheat Score": ModelTracker("Cheat Score"),
    }

    # ── Open camera ───────────────────────────────────────────────
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[Evaluator] ERROR: Cannot open webcam!")
        sys.exit(1)

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)

    # Start audio in background
    if audio:
        audio.start()

    print("\n[Evaluator] All models running on live camera.")
    print("[Evaluator] Press 'q' to stop and see the evaluation report.\n")

    # ── Anomaly event accumulator (for cheat score) ───────────────
    all_session_anomalies = []

    face_status = "unknown"
    gaze_status = "unknown"
    audio_status = "silence"

    frame_count = 0
    start_time = time.time()
    fps = 0.0
    fps_timer = time.time()
    fps_counter = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("[Evaluator] Lost webcam feed.")
                break

            frame = cv2.flip(frame, 1)
            frame_count += 1
            all_frame_events = []

            # ── 1. FACE DETECTION ─────────────────────────────────
            if face_det:
                try:
                    t0 = time.time()
                    frame, face_status, face_events = face_det.detect(frame)
                    dt = time.time() - t0

                    is_anomaly = face_status in ("no_face", "multiple_faces")
                    trackers["Face Detection"].record_frame(is_anomaly, face_events, dt)
                    all_frame_events.extend(face_events)
                except Exception:
                    trackers["Face Detection"].record_error()
                    face_status = "error"

            # ── 2. GAZE DETECTION ─────────────────────────────────
            if gaze_det:
                try:
                    t0 = time.time()
                    frame, gaze_status, gaze_events = gaze_det.detect(frame)
                    dt = time.time() - t0

                    is_anomaly = gaze_status != "looking_at_screen"
                    trackers["Gaze Detection"].record_frame(is_anomaly, gaze_events, dt)
                    all_frame_events.extend(gaze_events)
                except Exception:
                    trackers["Gaze Detection"].record_error()
                    gaze_status = "error"

            # ── 3. OBJECT DETECTION ───────────────────────────────
            if obj_det:
                try:
                    t0 = time.time()
                    frame, obj_events = obj_det.detect(frame)
                    dt = time.time() - t0

                    is_anomaly = len(obj_events) > 0
                    trackers["Object Detection"].record_frame(is_anomaly, obj_events, dt)
                    all_frame_events.extend(obj_events)
                except Exception:
                    trackers["Object Detection"].record_error()

            # ── 4. AUDIO MONITOR ──────────────────────────────────
            if audio:
                try:
                    audio_events = audio.collect_events()
                    audio_status = audio.status

                    is_anomaly = audio_status not in ("silence", "ambient_noise")
                    trackers["Audio Monitor"].record_frame(is_anomaly, audio_events, 0.0)
                    all_frame_events.extend(audio_events)
                except Exception:
                    trackers["Audio Monitor"].record_error()
                    audio_status = "error"

            # ── 5. CHEAT SCORE (Fusion) ───────────────────────────
            if cheat_calc and all_frame_events:
                try:
                    t0 = time.time()

                    # Format events for the calculator
                    for ev in all_frame_events:
                        all_session_anomalies.append({
                            "type": ev.get("event_type"),
                            "confidence": ev.get("confidence", 1.0),
                            "timestamp": time.time(),
                        })

                    result = cheat_calc.calculate(anomalies=all_session_anomalies)
                    dt = time.time() - t0

                    score = result.get("cheat_score", 0)
                    is_anomaly = score >= 20
                    # create a pseudo-event for tracking
                    score_events = [{"event_type": f"cheat_score_{result.get('risk_level', 'LOW')}",
                                     "confidence": score / 100.0}] if is_anomaly else []
                    trackers["Cheat Score"].record_frame(is_anomaly, score_events, dt)
                except Exception:
                    trackers["Cheat Score"].record_error()
            else:
                # No events this frame -> normal
                if cheat_calc:
                    trackers["Cheat Score"].record_frame(False, [], 0.0)

            # ── 6. DRAW ALERT BANNERS ─────────────────────────────
            alert_y = 0
            for ev in all_frame_events:
                label = ev["event_type"].replace("_", " ").upper()
                conf = ev.get("confidence", 1.0)
                draw_alert_banner(frame, f"!! {label} ({conf:.0%})", y_offset=alert_y)
                alert_y += 42

            # ── 7. STATUS BAR ─────────────────────────────────────
            draw_status_bar(frame, face_status, gaze_status, audio_status)

            # ── 8. LIVE STATS OVERLAY ─────────────────────────────
            # FPS calculation
            fps_counter += 1
            if time.time() - fps_timer >= 1.0:
                fps = fps_counter / (time.time() - fps_timer)
                fps_counter = 0
                fps_timer = time.time()

            draw_live_stats(frame, trackers, fps)

            # ── 9. DISPLAY ────────────────────────────────────────
            if show_display:
                cv2.imshow("Snoop AI Evaluator - Press 'q' to stop", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

            # ── 10. TIMEOUT CHECK ─────────────────────────────────
            if timeout > 0 and (time.time() - start_time) >= timeout:
                print(f"\n[Evaluator] Timeout reached ({timeout}s). Stopping...")
                break

    except KeyboardInterrupt:
        print("\n[Evaluator] Interrupted by user.")

    finally:
        # ── Cleanup ───────────────────────────────────────────────
        elapsed = time.time() - start_time

        if audio:
            audio.stop()
        cap.release()
        cv2.destroyAllWindows()

        # ── Compute & display results ─────────────────────────────
        print(f"\n[Evaluator] Session ended after {elapsed:.1f}s ({frame_count} frames)\n")

        all_metrics = []
        for name, tracker in trackers.items():
            metrics = tracker.get_metrics()
            all_metrics.append(metrics)

        print_results_table(all_metrics)
        save_results_csv(all_metrics)


# ═══════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════

def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Snoop AI Monitor -- Live Anomaly Detection Evaluator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python evaluator.py                  # Run until 'q' is pressed
  python evaluator.py --timeout 60     # Auto-stop after 60 seconds
  python evaluator.py --no-display     # Run headless (timeout required)
        """,
    )
    parser.add_argument(
        "--timeout", type=int, default=0,
        help="Auto-stop after N seconds (default: 0 = run until 'q')",
    )
    parser.add_argument(
        "--no-display", action="store_true", default=False,
        help="Run without camera display window",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    run_live_evaluation(
        timeout=args.timeout,
        show_display=not args.no_display,
    )
