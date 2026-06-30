#!/usr/bin/env python3
"""
Snoop AI Monitor — Complete Performance Evaluator
===================================================
Imports ALL AIMonitor modules (Face, Gaze, Object, Audio, CheatScore),
runs them on a live camera feed, and produces:

Performance Metrics:
    - Accuracy, Precision, Recall, F1-Score, Execution Time

Graphs & Results:
    - Accuracy Graph (per model over time)
    - Loss Graph (error rate over time)
    - Performance Comparison Graph (bar chart)

Usage:
    python snoop_evaluator.py                 # Interactive (press 'q' to stop)
    python snoop_evaluator.py --timeout 30    # Auto-stop after 30s
    python snoop_evaluator.py --timeout 60 --no-display

Author: Snoop AI Team
"""

import os
import sys
import csv
import time
import argparse
import numpy as np

# Ensure AIMonitor package is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import cv2

from config import FRAME_WIDTH, FRAME_HEIGHT, COLOR_ALERT, COLOR_INFO_TEXT
from object_detection import ObjectDetector
from face_detection import FaceDetector
from gaze_detection import GazeDetector
from audio_monitor import AudioMonitor
from cheat_score_calculator import CheatScoreCalculator

# ── Output paths ─────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(SCRIPT_DIR, "evaluation_output")
os.makedirs(RESULTS_DIR, exist_ok=True)

CSV_PATH = os.path.join(RESULTS_DIR, "metrics.csv")
ACCURACY_GRAPH = os.path.join(RESULTS_DIR, "accuracy_graph.png")
LOSS_GRAPH = os.path.join(RESULTS_DIR, "loss_graph.png")
COMPARISON_GRAPH = os.path.join(RESULTS_DIR, "comparison_graph.png")


# ═════════════════════════════════════════════════════════════════════
# ModelTracker — tracks TP/TN/FP/FN per model
# ═════════════════════════════════════════════════════════════════════

class ModelTracker:
    """Tracks per-frame classification metrics for a single model."""

    def __init__(self, name: str):
        self.name = name
        self.tp = 0  # True Positives  (model=anomaly, ground_truth=anomaly)
        self.tn = 0  # True Negatives  (model=normal,  ground_truth=normal)
        self.fp = 0  # False Positives (model=anomaly, ground_truth=normal)
        self.fn = 0  # False Negatives (model=normal,  ground_truth=anomaly)
        self.total_frames = 0
        self.total_events = 0
        self.exec_times = []          # seconds per frame
        self.errors = 0
        self.event_types = {}
        # Rolling history for graphs
        self.accuracy_history = []    # cumulative accuracy after each frame
        self.loss_history = []        # cumulative error rate after each frame

    def record(self, predicted_anomaly: bool, ground_truth_anomaly: bool,
               events: list, exec_time: float):
        self.total_frames += 1
        if predicted_anomaly and ground_truth_anomaly:
            self.tp += 1
        elif not predicted_anomaly and not ground_truth_anomaly:
            self.tn += 1
        elif predicted_anomaly and not ground_truth_anomaly:
            self.fp += 1
        else:
            self.fn += 1

        for ev in events:
            self.total_events += 1
            et = ev.get("event_type", "unknown")
            self.event_types[et] = self.event_types.get(et, 0) + 1

        self.exec_times.append(exec_time)
        # Rolling metrics
        total = self.tp + self.tn + self.fp + self.fn
        acc = (self.tp + self.tn) / total if total > 0 else 0
        self.accuracy_history.append(acc * 100)
        self.loss_history.append((1 - acc) * 100)

    def record_error(self):
        self.total_frames += 1
        self.errors += 1
        total = self.tp + self.tn + self.fp + self.fn
        acc = (self.tp + self.tn) / total if total > 0 else 0
        self.accuracy_history.append(acc * 100)
        self.loss_history.append((1 - acc) * 100)

    def metrics(self) -> dict:
        total = self.tp + self.tn + self.fp + self.fn
        accuracy = (self.tp + self.tn) / total * 100 if total else 0
        precision = self.tp / (self.tp + self.fp) * 100 if (self.tp + self.fp) else 0
        recall = self.tp / (self.tp + self.fn) * 100 if (self.tp + self.fn) else 0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0
        avg_ms = (sum(self.exec_times) / len(self.exec_times) * 1000) if self.exec_times else 0
        return {
            "name": self.name,
            "total_frames": self.total_frames,
            "tp": self.tp, "tn": self.tn, "fp": self.fp, "fn": self.fn,
            "accuracy": round(accuracy, 2),
            "precision": round(precision, 2),
            "recall": round(recall, 2),
            "f1_score": round(f1, 2),
            "avg_time_ms": round(avg_ms, 2),
            "total_events": self.total_events,
            "errors": self.errors,
            "event_breakdown": dict(self.event_types),
        }


# ═════════════════════════════════════════════════════════════════════
# Ground Truth via keyboard (live labeling)
# ═════════════════════════════════════════════════════════════════════

class GroundTruthLabeler:
    """
    During the live session the user holds a key to indicate 'cheating':
        Press & hold 'c' = cheating scenario active
        Release 'c'      = normal scenario

    This is polled every frame via cv2.waitKey.
    """
    def __init__(self):
        self.is_cheating = False

    def update(self, key: int):
        if key == ord('c'):
            self.is_cheating = True
        else:
            self.is_cheating = False


# ═════════════════════════════════════════════════════════════════════
# Graphs (matplotlib)
# ═════════════════════════════════════════════════════════════════════

def generate_graphs(trackers: dict):
    """Generate all three graphs using matplotlib."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("[WARN] matplotlib not installed — skipping graphs.")
        print("       Install with: pip install matplotlib")
        return

    colors = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6"]
    model_names = list(trackers.keys())

    # ── 1. Accuracy Graph (line chart over frames) ────────────────
    fig, ax = plt.subplots(figsize=(12, 6))
    fig.patch.set_facecolor("#1a1a2e")
    ax.set_facecolor("#16213e")

    for i, (name, t) in enumerate(trackers.items()):
        if t.accuracy_history:
            ax.plot(t.accuracy_history, label=name, color=colors[i % len(colors)],
                    linewidth=2, alpha=0.9)

    ax.set_title("Model Accuracy Over Time", fontsize=16, color="white", fontweight="bold", pad=15)
    ax.set_xlabel("Frame Number", fontsize=12, color="white")
    ax.set_ylabel("Cumulative Accuracy (%)", fontsize=12, color="white")
    ax.legend(loc="lower right", fontsize=10, facecolor="#0f3460", edgecolor="white",
              labelcolor="white")
    ax.tick_params(colors="white")
    ax.set_ylim(0, 105)
    ax.grid(True, alpha=0.2, color="white")
    for spine in ax.spines.values():
        spine.set_color("#0f3460")
    plt.tight_layout()
    plt.savefig(ACCURACY_GRAPH, dpi=150, facecolor=fig.get_facecolor())
    plt.close()
    print(f"  [SAVED] {ACCURACY_GRAPH}")

    # ── 2. Loss Graph (error rate over frames) ────────────────────
    fig, ax = plt.subplots(figsize=(12, 6))
    fig.patch.set_facecolor("#1a1a2e")
    ax.set_facecolor("#16213e")

    for i, (name, t) in enumerate(trackers.items()):
        if t.loss_history:
            ax.plot(t.loss_history, label=name, color=colors[i % len(colors)],
                    linewidth=2, alpha=0.9)

    ax.set_title("Model Error Rate (Loss) Over Time", fontsize=16, color="white",
                 fontweight="bold", pad=15)
    ax.set_xlabel("Frame Number", fontsize=12, color="white")
    ax.set_ylabel("Error Rate (%)", fontsize=12, color="white")
    ax.legend(loc="upper right", fontsize=10, facecolor="#0f3460", edgecolor="white",
              labelcolor="white")
    ax.tick_params(colors="white")
    ax.set_ylim(0, 105)
    ax.grid(True, alpha=0.2, color="white")
    for spine in ax.spines.values():
        spine.set_color("#0f3460")
    plt.tight_layout()
    plt.savefig(LOSS_GRAPH, dpi=150, facecolor=fig.get_facecolor())
    plt.close()
    print(f"  [SAVED] {LOSS_GRAPH}")

    # ── 3. Performance Comparison (grouped bar chart) ─────────────
    metrics_list = [trackers[n].metrics() for n in model_names]
    metric_keys = ["accuracy", "precision", "recall", "f1_score"]
    metric_labels = ["Accuracy", "Precision", "Recall", "F1-Score"]

    x = np.arange(len(model_names))
    width = 0.18
    fig, ax = plt.subplots(figsize=(14, 7))
    fig.patch.set_facecolor("#1a1a2e")
    ax.set_facecolor("#16213e")

    bar_colors = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"]
    for j, (key, label) in enumerate(zip(metric_keys, metric_labels)):
        values = [m[key] for m in metrics_list]
        bars = ax.bar(x + j * width, values, width, label=label, color=bar_colors[j],
                      edgecolor="white", linewidth=0.5, alpha=0.9)
        for bar, val in zip(bars, values):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 1,
                    f"{val:.1f}", ha="center", va="bottom", fontsize=8, color="white")

    ax.set_title("Performance Comparison Across Models", fontsize=16, color="white",
                 fontweight="bold", pad=15)
    ax.set_ylabel("Score (%)", fontsize=12, color="white")
    ax.set_xticks(x + width * 1.5)
    ax.set_xticklabels(model_names, fontsize=10, color="white")
    ax.legend(fontsize=10, facecolor="#0f3460", edgecolor="white", labelcolor="white")
    ax.tick_params(colors="white")
    ax.set_ylim(0, 115)
    ax.grid(True, axis="y", alpha=0.2, color="white")
    for spine in ax.spines.values():
        spine.set_color("#0f3460")
    plt.tight_layout()
    plt.savefig(COMPARISON_GRAPH, dpi=150, facecolor=fig.get_facecolor())
    plt.close()
    print(f"  [SAVED] {COMPARISON_GRAPH}")


# ═════════════════════════════════════════════════════════════════════
# Console Report
# ═════════════════════════════════════════════════════════════════════

def print_report(all_metrics: list, elapsed: float, frame_count: int):
    print("\n")
    print("=" * 110)
    print("   SNOOP AI MONITOR — COMPLETE PERFORMANCE EVALUATION REPORT")
    print(f"   Session: {elapsed:.1f}s | {frame_count} frames | {frame_count/elapsed:.1f} FPS")
    print("=" * 110)

    hdr = (f"{'Model':<20} | {'TP':>4} {'TN':>4} {'FP':>4} {'FN':>4} | "
           f"{'Acc%':>6} {'Prec%':>6} {'Rec%':>6} {'F1%':>6} | "
           f"{'ms':>7} | {'Events':>6} | {'Err':>3}")
    print("-" * len(hdr))
    print(hdr)
    print("-" * len(hdr))

    for m in all_metrics:
        row = (f"{m['name']:<20} | "
               f"{m['tp']:>4} {m['tn']:>4} {m['fp']:>4} {m['fn']:>4} | "
               f"{m['accuracy']:>5.1f}% {m['precision']:>5.1f}% "
               f"{m['recall']:>5.1f}% {m['f1_score']:>5.1f}% | "
               f"{m['avg_time_ms']:>6.1f} | {m['total_events']:>6} | {m['errors']:>3}")
        print(row)

    print("-" * len(hdr))

    # Event breakdown
    print("\n--- EVENT BREAKDOWN ---\n")
    for m in all_metrics:
        if m["event_breakdown"]:
            print(f"  [{m['name']}]")
            for et, cnt in sorted(m["event_breakdown"].items(), key=lambda x: -x[1]):
                print(f"    {et:<35} : {cnt}")
            print()

    print("=" * 110)


def save_csv(all_metrics: list):
    fields = ["model", "tp", "tn", "fp", "fn", "accuracy", "precision",
              "recall", "f1_score", "avg_time_ms", "total_events", "errors"]
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for m in all_metrics:
            w.writerow({k: m[k] for k in fields if k != "model"} | {"model": m["name"]})
    print(f"  [SAVED] {CSV_PATH}")


# ═════════════════════════════════════════════════════════════════════
# HUD Helpers
# ═════════════════════════════════════════════════════════════════════

def draw_banner(frame, text, y_off=0):
    h, w = frame.shape[:2]
    ov = frame.copy()
    y = 50 + y_off
    cv2.rectangle(ov, (0, y), (w, y + 36), COLOR_ALERT, -1)
    cv2.addWeighted(ov, 0.55, frame, 0.45, 0, frame)
    cv2.putText(frame, text, (12, y + 26),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)


def draw_statusbar(frame, face, gaze, audio, gt):
    h, w = frame.shape[:2]
    cv2.rectangle(frame, (0, h - 40), (w, h), (30, 30, 30), -1)
    gt_label = "CHEATING" if gt else "NORMAL"
    gt_color = (0, 0, 255) if gt else (0, 255, 0)
    info = (f"Face: {face}  |  Gaze: {gaze.replace('_',' ').title()}  |  "
            f"Audio: {audio.replace('_',' ').title()}")
    cv2.putText(frame, info, (12, h - 12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, COLOR_INFO_TEXT, 1)
    cv2.putText(frame, f"GT: {gt_label}", (w - 180, h - 12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, gt_color, 2)


def draw_live_stats(frame, trackers, fps, gt):
    ov = frame.copy()
    cv2.rectangle(ov, (0, 0), (400, 55 + len(trackers) * 22), (0, 0, 0), -1)
    cv2.addWeighted(ov, 0.6, frame, 0.4, 0, frame)
    y = 18
    gt_str = "CHEATING" if gt else "NORMAL"
    cv2.putText(frame, f"EVALUATOR | FPS: {fps:.1f} | GT: {gt_str}", (8, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
    y += 8
    for name, t in trackers.items():
        y += 22
        m = t.metrics()
        color = (0, 255, 0) if m["accuracy"] > 80 else (0, 165, 255) if m["accuracy"] > 50 else (0, 0, 255)
        cv2.putText(frame, f"{name}: Acc={m['accuracy']:.1f}% F1={m['f1_score']:.1f}%",
                    (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, color, 1)


# ═════════════════════════════════════════════════════════════════════
# Main Evaluation Pipeline
# ═════════════════════════════════════════════════════════════════════

def run_evaluation(timeout=0, show_display=True):
    print("[Evaluator] Initializing all AIMonitor models...\n")

    # Load models
    models = {}
    for name, cls in [("Object Detection", ObjectDetector),
                      ("Face Detection", FaceDetector),
                      ("Gaze Detection", GazeDetector),
                      ("Audio Monitor", AudioMonitor)]:
        try:
            models[name] = cls()
            print(f"  [OK] {name}")
        except Exception as e:
            models[name] = None
            print(f"  [FAIL] {name}: {e}")

    try:
        cheat_calc = CheatScoreCalculator(time_window=10)
        print("  [OK] Cheat Score Calculator")
    except Exception as e:
        cheat_calc = None
        print(f"  [FAIL] CheatScoreCalculator: {e}")

    # Trackers
    trackers = {n: ModelTracker(n) for n in
                ["Face Detection", "Gaze Detection", "Object Detection",
                 "Audio Monitor", "Cheat Score"]}

    # Camera
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[ERROR] Cannot open webcam!")
        sys.exit(1)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)

    if models["Audio Monitor"]:
        models["Audio Monitor"].start()

    gt = GroundTruthLabeler()
    session_anomalies = []
    face_status = gaze_status = "unknown"
    audio_status = "silence"
    frame_count = 0
    start = time.time()
    fps = 0.0
    fps_timer = time.time()
    fps_cnt = 0

    print("\n" + "=" * 60)
    print("  LIVE EVALUATION RUNNING")
    print("  Hold 'c' = mark as CHEATING | Release = NORMAL")
    print("  Press 'q' to STOP and generate report")
    print("=" * 60 + "\n")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame = cv2.flip(frame, 1)
            frame_count += 1
            all_events = []
            is_gt = gt.is_cheating

            # 1. Face Detection
            fd = models["Face Detection"]
            if fd:
                try:
                    t0 = time.time()
                    frame, face_status, fe = fd.detect(frame)
                    dt = time.time() - t0
                    pred = face_status in ("no_face", "multiple_faces")
                    trackers["Face Detection"].record(pred, is_gt, fe, dt)
                    all_events.extend(fe)
                except Exception:
                    trackers["Face Detection"].record_error()

            # 2. Gaze Detection
            gd = models["Gaze Detection"]
            if gd:
                try:
                    t0 = time.time()
                    frame, gaze_status, ge = gd.detect(frame)
                    dt = time.time() - t0
                    pred = gaze_status != "looking_at_screen"
                    trackers["Gaze Detection"].record(pred, is_gt, ge, dt)
                    all_events.extend(ge)
                except Exception:
                    trackers["Gaze Detection"].record_error()

            # 3. Object Detection
            od = models["Object Detection"]
            if od:
                try:
                    t0 = time.time()
                    frame, oe = od.detect(frame)
                    dt = time.time() - t0
                    pred = len(oe) > 0
                    trackers["Object Detection"].record(pred, is_gt, oe, dt)
                    all_events.extend(oe)
                except Exception:
                    trackers["Object Detection"].record_error()

            # 4. Audio Monitor
            am = models["Audio Monitor"]
            if am:
                try:
                    ae = am.collect_events()
                    audio_status = am.status
                    pred = audio_status not in ("silence", "ambient_noise")
                    trackers["Audio Monitor"].record(pred, is_gt, ae, 0.0)
                    all_events.extend(ae)
                except Exception:
                    trackers["Audio Monitor"].record_error()

            # 5. Cheat Score
            if cheat_calc:
                try:
                    t0 = time.time()
                    for ev in all_events:
                        session_anomalies.append({
                            "type": ev.get("event_type"),
                            "confidence": ev.get("confidence", 1.0),
                            "timestamp": time.time(),
                        })
                    res = cheat_calc.calculate(anomalies=session_anomalies)
                    dt = time.time() - t0
                    score = res.get("cheat_score", 0)
                    pred = score >= 20
                    sev = [{"event_type": f"cheat_{res.get('risk_level','LOW')}",
                            "confidence": score / 100}] if pred else []
                    trackers["Cheat Score"].record(pred, is_gt, sev, dt)
                except Exception:
                    trackers["Cheat Score"].record_error()

            # Draw overlays
            ay = 0
            for ev in all_events:
                lbl = ev["event_type"].replace("_", " ").upper()
                c = ev.get("confidence", 1.0)
                draw_banner(frame, f"!! {lbl} ({c:.0%})", y_off=ay)
                ay += 42

            draw_statusbar(frame, face_status, gaze_status, audio_status, is_gt)

            fps_cnt += 1
            if time.time() - fps_timer >= 1.0:
                fps = fps_cnt / (time.time() - fps_timer)
                fps_cnt = 0
                fps_timer = time.time()

            draw_live_stats(frame, trackers, fps, is_gt)

            if show_display:
                cv2.imshow("Snoop Evaluator | 'c'=cheat 'q'=quit", frame)
                key = cv2.waitKey(1) & 0xFF
                gt.update(key)
                if key == ord("q"):
                    break
            else:
                gt.is_cheating = False

            if timeout > 0 and (time.time() - start) >= timeout:
                print(f"\n[Evaluator] Timeout ({timeout}s). Stopping...")
                break

    except KeyboardInterrupt:
        print("\n[Evaluator] Interrupted.")

    finally:
        elapsed = time.time() - start
        if models["Audio Monitor"]:
            models["Audio Monitor"].stop()
        cap.release()
        cv2.destroyAllWindows()

        # Collect metrics
        all_metrics = [trackers[n].metrics() for n in trackers]

        # Print report
        print_report(all_metrics, elapsed, frame_count)

        # Save CSV
        save_csv(all_metrics)

        # Generate graphs
        print("\n[Evaluator] Generating graphs...")
        generate_graphs(trackers)

        print(f"\n[DONE] All outputs saved to: {RESULTS_DIR}")


# ═════════════════════════════════════════════════════════════════════
# CLI
# ═════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Snoop AI Monitor — Complete Performance Evaluator")
    parser.add_argument("--timeout", type=int, default=0,
                        help="Auto-stop after N seconds (0=manual)")
    parser.add_argument("--no-display", action="store_true",
                        help="Headless mode (requires --timeout)")
    args = parser.parse_args()

    run_evaluation(timeout=args.timeout, show_display=not args.no_display)
