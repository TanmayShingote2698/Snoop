"""
Snoop AI Monitor — Face Detection Module
==========================================
Uses MTCNN (facenet-pytorch) with OpenCV to detect faces.

Classification:
    - no_face         → anomaly
    - multiple_faces  → anomaly
    - normal_face     → OK
"""

import cv2
import numpy as np
from facenet_pytorch import MTCNN as _MTCNN

from config import (
    MTCNN_MIN_FACE_SIZE,
    MTCNN_CONFIDENCE_THRESHOLD,
    COLOR_FACE_BOX,
)


class FaceDetector:
    """Detect and classify faces in a frame using MTCNN."""

    def __init__(self):
        # keep_all=True so we get every face, not just the largest
        self.detector = _MTCNN(
            keep_all=True,
            min_face_size=MTCNN_MIN_FACE_SIZE,
            thresholds=[0.6, 0.7, 0.7],
            device="cpu",
        )

    # ── public API ────────────────────────────────────────────────────

    def detect(self, frame: np.ndarray) -> tuple[np.ndarray, str, list[dict]]:
        """
        Detect faces in *frame*.

        Returns
        -------
        annotated_frame : np.ndarray
        face_status     : str   — 'no_face' | 'multiple_faces' | 'normal_face'
        events          : list[dict]
        """
        # MTCNN expects RGB
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        boxes, confidences = self.detector.detect(rgb)

        events: list[dict] = []

        if boxes is None or len(boxes) == 0:
            face_status = "no_face"
            events.append({
                "event_type": "no_face_detected",
                "confidence": 1.0,
            })
            return frame, face_status, events

        # Filter by confidence
        valid_boxes = []
        valid_confs = []
        for box, conf in zip(boxes, confidences):
            if conf is not None and conf >= MTCNN_CONFIDENCE_THRESHOLD:
                valid_boxes.append(box)
                valid_confs.append(conf)

        if len(valid_boxes) == 0:
            face_status = "no_face"
            events.append({
                "event_type": "no_face_detected",
                "confidence": 1.0,
            })
        elif len(valid_boxes) == 1:
            face_status = "normal_face"
        else:
            face_status = "multiple_faces"
            events.append({
                "event_type": "multiple_faces_detected",
                "confidence": float(max(valid_confs)),
            })

        # Draw bounding boxes
        for box, conf in zip(valid_boxes, valid_confs):
            x1, y1, x2, y2 = map(int, box)
            cv2.rectangle(frame, (x1, y1), (x2, y2), COLOR_FACE_BOX, 2)
            cv2.putText(frame, f"Face {conf:.2f}", (x1, y1 - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, COLOR_FACE_BOX, 2)

        return frame, face_status, events
