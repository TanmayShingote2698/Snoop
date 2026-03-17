"""
Snoop AI Monitor — Monitoring Pipeline
=======================================
Main entry point that ties every detection module together.

Workflow
--------
1.  Open the webcam via OpenCV.
2.  For each frame run:
        • Object Detection   (YOLOv8)
        • Face Detection      (MTCNN)
        • Gaze Detection      (MediaPipe FaceMesh)
3.  In a background thread:
        • Audio Monitoring    (PyAudio + Librosa)
4.  Overlay bounding boxes, gaze status, and anomaly alerts on the
    live video feed.
5.  Log every anomaly event via EventLogger.
6.  Press **q** to quit.

Usage
-----
    python monitoring_pipeline.py
"""

import sys
import os
import time
import cv2

# Ensure the AIMonitor package is on the path when run directly
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import (
    FRAME_WIDTH,
    FRAME_HEIGHT,
    COLOR_ALERT,
    COLOR_INFO_TEXT,
    COLOR_GAZE_TEXT,
)
from event_logger      import EventLogger
from object_detection  import ObjectDetector
from face_detection    import FaceDetector
from gaze_detection    import GazeDetector
from audio_monitor     import AudioMonitor


# ── HUD helpers ───────────────────────────────────────────────────────

def _draw_alert_banner(frame, text: str, y_offset: int = 0):
    """Draw a translucent red banner at the top of the frame."""
    h, w = frame.shape[:2]
    overlay = frame.copy()
    y = 50 + y_offset
    cv2.rectangle(overlay, (0, y), (w, y + 36), COLOR_ALERT, -1)
    cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)
    cv2.putText(frame, text, (12, y + 26),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)


def _draw_status_bar(frame, face_status: str, gaze_status: str,
                     audio_status: str):
    """Draw a status bar along the bottom of the frame."""
    h, w = frame.shape[:2]
    cv2.rectangle(frame, (0, h - 40), (w, h), (30, 30, 30), -1)
    info = (f"Face: {face_status}  |  "
            f"Gaze: {gaze_status.replace('_', ' ').title()}  |  "
            f"Audio: {audio_status.replace('_', ' ').title()}")
    cv2.putText(frame, info, (12, h - 12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, COLOR_INFO_TEXT, 1)


# ── Main loop ─────────────────────────────────────────────────────────

def main():
    print("[Pipeline] Initialising modules …")

    logger   = EventLogger()
    obj_det  = ObjectDetector()
    face_det = FaceDetector()
    gaze_det = GazeDetector()
    audio    = AudioMonitor()

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[Pipeline] ERROR: cannot open webcam.")
        sys.exit(1)

    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)

    audio.start()
    print("[Pipeline] Running — press 'q' to quit.")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("[Pipeline] Lost webcam feed.")
                break

            # Flip for mirror effect
            frame = cv2.flip(frame, 1)

            # ── 1. Object Detection ──────────────────────────────────
            frame, obj_events = obj_det.detect(frame)

            # ── 2. Face Detection ────────────────────────────────────
            frame, face_status, face_events = face_det.detect(frame)

            # ── 3. Gaze Detection ────────────────────────────────────
            frame, gaze_status, gaze_events = gaze_det.detect(frame)

            # ── 4. Audio (collect from bg thread) ────────────────────
            audio_events = audio.collect_events()
            audio_status = audio.status

            # ── 5. Log all anomaly events ────────────────────────────
            all_events = obj_events + face_events + gaze_events + audio_events
            for ev in all_events:
                logger.log_event(ev["event_type"], ev.get("confidence", 1.0))

            # ── 6. Draw alert banners ────────────────────────────────
            alert_y = 0
            for ev in all_events:
                label = ev["event_type"].replace("_", " ").upper()
                conf  = ev.get("confidence", 1.0)
                _draw_alert_banner(frame,
                                   f"⚠  {label}  ({conf:.0%})",
                                   y_offset=alert_y)
                alert_y += 42

            # ── 7. Status bar ────────────────────────────────────────
            _draw_status_bar(frame, face_status, gaze_status, audio_status)

            # ── 8. Show frame ────────────────────────────────────────
            cv2.imshow("Snoop AI Monitor", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    finally:
        audio.stop()
        cap.release()
        cv2.destroyAllWindows()
        print(f"[Pipeline] Stopped. {len(logger.get_all_events())} events logged.")
        print(f"[Pipeline] Log file → {os.path.join(os.path.dirname(__file__), 'anomaly_log.json')}")


if __name__ == "__main__":
    main()

"""
Snoop AI Monitor — Parallel Monitoring Pipeline
==============================================

Optimized pipeline with threaded workers for smoother execution.
"""

# import sys
# import os
# import cv2
# import threading
# from queue import Queue

# sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# from config import (
#     FRAME_WIDTH,
#     FRAME_HEIGHT,
#     COLOR_ALERT,
#     COLOR_INFO_TEXT,
# )

# from event_logger import EventLogger
# from object_detection import ObjectDetector
# from face_detection import FaceDetector
# from gaze_detection import GazeDetector
# from audio_monitor import AudioMonitor


# # ── HUD helpers ─────────────────────────────────────────

# def _draw_alert_banner(frame, text: str, y_offset: int = 0):

#     h, w = frame.shape[:2]

#     overlay = frame.copy()
#     y = 50 + y_offset

#     cv2.rectangle(overlay, (0, y), (w, y + 36), COLOR_ALERT, -1)

#     cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)

#     cv2.putText(
#         frame,
#         text,
#         (12, y + 26),
#         cv2.FONT_HERSHEY_SIMPLEX,
#         0.7,
#         (255, 255, 255),
#         2,
#     )


# def _draw_status_bar(frame, face_status, gaze_status, audio_status):

#     h, w = frame.shape[:2]

#     cv2.rectangle(frame, (0, h - 40), (w, h), (30, 30, 30), -1)

#     info = (
#         f"Face: {face_status} | "
#         f"Gaze: {gaze_status.replace('_',' ').title()} | "
#         f"Audio: {audio_status.replace('_',' ').title()}"
#     )

#     cv2.putText(
#         frame,
#         info,
#         (12, h - 12),
#         cv2.FONT_HERSHEY_SIMPLEX,
#         0.55,
#         COLOR_INFO_TEXT,
#         1,
#     )


# # ── Worker Thread ───────────────────────────────────────

# def detection_worker(frame_queue, result_queue, obj_det, face_det, gaze_det):

#     while True:

#         frame = frame_queue.get()

#         if frame is None:
#             break

#         # run detection models
#         frame, obj_events = obj_det.detect(frame)

#         frame, face_status, face_events = face_det.detect(frame)

#         frame, gaze_status, gaze_events = gaze_det.detect(frame)

#         result_queue.put(
#             (frame, obj_events, face_status, face_events, gaze_status, gaze_events)
#         )


# # ── Main Pipeline ───────────────────────────────────────

# def main():

#     print("[Pipeline] Initialising modules …")

#     logger = EventLogger()

#     obj_det = ObjectDetector()
#     face_det = FaceDetector()
#     gaze_det = GazeDetector()

#     audio = AudioMonitor()

#     cap = cv2.VideoCapture(0)

#     if not cap.isOpened():
#         print("[Pipeline] ERROR: cannot open webcam.")
#         sys.exit(1)

#     cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
#     cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)

#     cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

#     # queues
#     frame_queue = Queue(maxsize=5)
#     result_queue = Queue(maxsize=5)

#     # worker threads
#     workers = []

#     for _ in range(2):

#         t = threading.Thread(
#             target=detection_worker,
#             args=(frame_queue, result_queue, obj_det, face_det, gaze_det),
#             daemon=True,
#         )

#         t.start()

#         workers.append(t)

#     audio.start()

#     print("[Pipeline] Running — press 'q' to quit.")

#     try:

#         while True:

#             ret, frame = cap.read()

#             if not ret:
#                 print("[Pipeline] Lost webcam feed.")
#                 break

#             frame = cv2.flip(frame, 1)

#             if not frame_queue.full():
#                 frame_queue.put(frame)

#             if not result_queue.empty():

#                 (
#                     frame,
#                     obj_events,
#                     face_status,
#                     face_events,
#                     gaze_status,
#                     gaze_events,
#                 ) = result_queue.get()

#                 audio_events = audio.collect_events()
#                 audio_status = audio.status

#                 all_events = obj_events + face_events + gaze_events + audio_events

#                 for ev in all_events:
#                     logger.log_event(ev["event_type"], ev.get("confidence", 1.0))

#                 alert_y = 0

#                 for ev in all_events:

#                     label = ev["event_type"].replace("_", " ").upper()

#                     conf = ev.get("confidence", 1.0)

#                     _draw_alert_banner(
#                         frame,
#                         f"⚠ {label} ({conf:.0%})",
#                         y_offset=alert_y,
#                     )

#                     alert_y += 42

#                 _draw_status_bar(frame, face_status, gaze_status, audio_status)

#                 cv2.imshow("Snoop AI Monitor", frame)

#             key = cv2.waitKey(1)

#             if key == ord("q"):
#                 break

#     finally:

#         audio.stop()

#         cap.release()

#         cv2.destroyAllWindows()

#         print(
#             f"[Pipeline] Stopped. {len(logger.get_all_events())} events logged."
#         )


# if __name__ == "__main__":
#     main()
