"""
Snoop AI Monitor — Face Detection Module
==========================================
Uses MTCNN (facenet-pytorch) with OpenCV to detect faces.

Classification:
    - no_face         → anomaly
    - multiple_faces  → anomaly
    - normal_face     → OK
"""

# import cv2
# import numpy as np
# from facenet_pytorch import MTCNN as _MTCNN

# from config import (
#     MTCNN_MIN_FACE_SIZE,
#     MTCNN_CONFIDENCE_THRESHOLD,
#     COLOR_FACE_BOX,
# )


# class FaceDetector:
#     """Detect and classify faces in a frame using MTCNN."""

#     def __init__(self):
#         # keep_all=True so we get every face, not just the largest
#         self.detector = _MTCNN(
#             keep_all=True,
#             min_face_size=MTCNN_MIN_FACE_SIZE,
#             thresholds=[0.6, 0.7, 0.7],
#             device="cpu",
#         )

#     # ── public API ────────────────────────────────────────────────────

#     def detect(self, frame: np.ndarray) -> tuple[np.ndarray, str, list[dict]]:
#         """
#         Detect faces in *frame*.

#         Returns
#         -------
#         annotated_frame : np.ndarray
#         face_status     : str   — 'no_face' | 'multiple_faces' | 'normal_face'
#         events          : list[dict]
#         """
#         # MTCNN expects RGB
#         rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
#         boxes, confidences = self.detector.detect(rgb)

#         events: list[dict] = []

#         if boxes is None or len(boxes) == 0:
#             face_status = "no_face"
#             events.append({
#                 "event_type": "no_face_detected",
#                 "confidence": 1.0,
#             })
#             return frame, face_status, events

#         # Filter by confidence
#         valid_boxes = []
#         valid_confs = []
#         for box, conf in zip(boxes, confidences):
#             if conf is not None and conf >= MTCNN_CONFIDENCE_THRESHOLD:
#                 valid_boxes.append(box)
#                 valid_confs.append(conf)

#         if len(valid_boxes) == 0:
#             face_status = "no_face"
#             events.append({
#                 "event_type": "no_face_detected",
#                 "confidence": 1.0,
#             })
#         elif len(valid_boxes) == 1:
#             face_status = "normal_face"
#         else:
#             face_status = "multiple_faces"
#             events.append({
#                 "event_type": "multiple_faces_detected",
#                 "confidence": float(max(valid_confs)),
#             })

#         # Draw bounding boxes
#         for box, conf in zip(valid_boxes, valid_confs):
#             x1, y1, x2, y2 = map(int, box)
#             cv2.rectangle(frame, (x1, y1), (x2, y2), COLOR_FACE_BOX, 2)
#             cv2.putText(frame, f"Face {conf:.2f}", (x1, y1 - 8),
#                         cv2.FONT_HERSHEY_SIMPLEX, 0.55, COLOR_FACE_BOX, 2)

#         return frame, face_status, events

import cv2
import numpy as np
import time
import torch
from facenet_pytorch import MTCNN as _MTCNN

from config import (
    MTCNN_MIN_FACE_SIZE,
    MTCNN_CONFIDENCE_THRESHOLD,
    COLOR_FACE_BOX,
)


class FaceDetector:
    def __init__(self):
        # Auto GPU/CPU selection
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        self.detector = _MTCNN(
            keep_all=True,
            min_face_size=MTCNN_MIN_FACE_SIZE,
            thresholds=[0.6, 0.7, 0.7],
            device=self.device,
        )

        # Stability tracking
        self.face_history = []
        self.history_size = 5

        # Cooldown for events
        self.last_event_time = {}
        self.cooldown_seconds = 2

    # ─────────────────────────────────────────────

    def update_history(self, count):
        self.face_history.append(count)
        if len(self.face_history) > self.history_size:
            self.face_history.pop(0)

    def get_stable_count(self):
        if not self.face_history:
            return 0
        return round(sum(self.face_history) / len(self.face_history))

    def should_trigger(self, event_name):
        now = time.time()

        if event_name not in self.last_event_time:
            self.last_event_time[event_name] = now
            return True

        if now - self.last_event_time[event_name] > self.cooldown_seconds:
            self.last_event_time[event_name] = now
            return True

        return False

    # ─────────────────────────────────────────────

    def detect(self, frame: np.ndarray):
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        boxes, confidences = self.detector.detect(rgb)

        events = []
        valid_faces = []

        if boxes is not None:
            for box, conf in zip(boxes, confidences):
                if conf is None or conf < MTCNN_CONFIDENCE_THRESHOLD:
                    continue

                x1, y1, x2, y2 = map(int, box)

                # Filter very small faces (noise)
                area = (x2 - x1) * (y2 - y1)
                if area < 1500:
                    continue

                valid_faces.append((x1, y1, x2, y2, conf))

        # Update history
        face_count = len(valid_faces)
        self.update_history(face_count)
        stable_count = self.get_stable_count()

        # Determine status
        if stable_count == 0:
            face_status = "no_face"

            if self.should_trigger("no_face"):
                events.append({
                    "event_type": "no_face_detected",
                    "confidence": 1.0,
                    "severity": "high"
                })

        elif stable_count == 1:
            face_status = "normal_face"

        else:
            face_status = "multiple_faces"

            if self.should_trigger("multiple_faces"):
                events.append({
                    "event_type": "multiple_faces_detected",
                    "confidence": 1.0,
                    "severity": "high"
                })

        # Draw boxes
        for (x1, y1, x2, y2, conf) in valid_faces:
            cv2.rectangle(frame, (x1, y1), (x2, y2), COLOR_FACE_BOX, 2)

            cv2.putText(
                frame,
                f"Face {conf:.2f}",
                (x1, y1 - 8),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                COLOR_FACE_BOX,
                2
            )

        # Display status on screen
        cv2.putText(
            frame,
            f"Faces: {stable_count} | Status: {face_status}",
            (20, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 255),
            2
        )

        return frame, face_status, events
