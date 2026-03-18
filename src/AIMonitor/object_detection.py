

"""
Snoop AI Monitor — Optimized Object Detection Module
====================================================
Improved YOLOv8 detection with:
- Class-specific thresholds
- Temporal stability
- Event cooldown
- Noise filtering
"""
import cv2
import numpy as np
import time
from ultralytics import YOLO

from config import (
    YOLO_MODEL_PATH,
    YOLO_CONFIDENCE_THRESHOLD,
    YOLO_IOU_THRESHOLD,
    TARGET_CLASSES,
    SUSPICIOUS_OBJECTS,
    COLOR_OBJECT_BOX,
    PERSON_CONFIDENCE_THRESHOLD,
)


class ObjectDetector:
    def __init__(self):
        self.model = YOLO(YOLO_MODEL_PATH)

        self.object_history = {}
        self.last_event_time = {}

        self.history_threshold = 3
        self.cooldown_seconds = 3

        self.class_conf_thresholds = {
            "person": 0.45,
            "cell phone": 0.20,
            "book": 0.25,
            "laptop": 0.30,
        }

    def update_history(self, label):
        self.object_history[label] = self.object_history.get(label, 0) + 1

    def is_stable(self, label):
        return self.object_history.get(label, 0) >= self.history_threshold

    def should_trigger(self, label):
        now = time.time()

        if label not in self.last_event_time:
            self.last_event_time[label] = now
            return True

        if now - self.last_event_time[label] > self.cooldown_seconds:
            self.last_event_time[label] = now
            return True

        return False

    def get_color(self, label):
        if label == "cell phone":
            return COLOR_OBJECT_BOX["HIGH"]

        elif label in {"laptop", "book"}:
            return COLOR_OBJECT_BOX["MEDIUM"]

        elif label in {"tv", "remote", "keyboard", "mouse"}:
            return COLOR_OBJECT_BOX["LOW"]

        else:
            return COLOR_OBJECT_BOX["NORMAL"]

    def detect(self, frame: np.ndarray):
        frame = cv2.resize(frame, (1280, 720))

        results = self.model(
            frame,
            verbose=False,
            conf=YOLO_CONFIDENCE_THRESHOLD,
            iou=YOLO_IOU_THRESHOLD
        )[0]

        events = []
        person_count = 0

        for box in results.boxes:
            cls_id = int(box.cls[0])

            if cls_id not in TARGET_CLASSES:
                continue

            label = TARGET_CLASSES[cls_id]
            conf = float(box.conf[0])
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            if conf < self.class_conf_thresholds.get(label, 0.3):
                continue

            area = (x2 - x1) * (y2 - y1)
            if label != "person" and area < 600:
                continue

            color = self.get_color(label)

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(
                frame,
                f"{label} {conf:.2f}",
                (x1, y1 - 8),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                2
            )

            if label == "person" and conf > PERSON_CONFIDENCE_THRESHOLD:
                person_count += 1

            if label in SUSPICIOUS_OBJECTS:
                self.update_history(label)

                if self.is_stable(label) and self.should_trigger(label):
                    events.append({
                        "event_type": f"{label.replace(' ', '_')}_detected",
                        "confidence": conf,
                        "severity": "high"
                    })

        if person_count > 1:
            if self.should_trigger("multiple_persons"):
                events.append({
                    "event_type": "multiple_persons_detected",
                    "confidence": 1.0,
                    "severity": "high"
                })

        return frame, events