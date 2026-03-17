"""
Snoop AI Monitor — Object Detection Module
============================================
Uses YOLOv8 (ultralytics) to detect target objects in each frame.

Tracked objects : person, cell phone, book, laptop
Anomaly triggers: cell phone / book / laptop detected, or >1 person visible.
"""

import cv2
import numpy as np
from ultralytics import YOLO

from config import (
    YOLO_MODEL_PATH,
    YOLO_CONFIDENCE_THRESHOLD,
    TARGET_CLASSES,
    SUSPICIOUS_OBJECTS,
    COLOR_OBJECT_BOX,
)


class ObjectDetector:
    """Thin wrapper around YOLOv8 that filters for exam-relevant classes."""

    def __init__(self):
        self.model = YOLO(YOLO_MODEL_PATH)

    # ── public API ────────────────────────────────────────────────────

    def detect(self, frame: np.ndarray) -> tuple[np.ndarray, list[dict]]:
        """
        Run detection on *frame*.

        Returns
        -------
        annotated_frame : np.ndarray
            Frame with bounding boxes drawn.
        events : list[dict]
            List of anomaly event dicts (may be empty).
        """
        results = self.model(frame, verbose=False,
                             conf=YOLO_CONFIDENCE_THRESHOLD)[0]

        events: list[dict] = []
        person_count = 0

        for box in results.boxes:
            cls_id = int(box.cls[0])
            if cls_id not in TARGET_CLASSES:
                continue

            label = TARGET_CLASSES[cls_id]
            conf  = float(box.conf[0])
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            # Draw bounding box
            cv2.rectangle(frame, (x1, y1), (x2, y2), COLOR_OBJECT_BOX, 2)
            text = f"{label} {conf:.2f}"
            cv2.putText(frame, text, (x1, y1 - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, COLOR_OBJECT_BOX, 2)

            # Count persons
            if label == "person":
                person_count += 1

            # Suspicious object → anomaly
            if label in SUSPICIOUS_OBJECTS:
                events.append({
                    "event_type": f"{label.replace(' ', '_')}_detected",
                    "confidence": conf,
                })

        # Multiple persons → anomaly
        if person_count > 1:
            events.append({
                "event_type": "multiple_persons_detected",
                "confidence": 1.0,
            })

        return frame, events