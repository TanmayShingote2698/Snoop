import os
import cv2
from datetime import datetime


class UpperBodyDetection:

    def __init__(self):
        # -------- Resolve absolute path safely -------- #
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))

        self.CASCADE_PATH = os.path.join(
            BASE_DIR,
            "weights",
            "haarcascade_upperbody.xml"
        )

        if not os.path.exists(self.CASCADE_PATH):
            raise FileNotFoundError(
                f"Upper-body cascade not found: {self.CASCADE_PATH}"
            )

        self.haar_upper_body_cascade = cv2.CascadeClassifier(self.CASCADE_PATH)

        if self.haar_upper_body_cascade.empty():
            raise RuntimeError(
                f"Failed to load Haar cascade: {self.CASCADE_PATH}"
            )

        self.integrity = {
            "extra-people-found": []
        }

    def run(self, frame, result):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        upper_body = self.haar_upper_body_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(50, 100),
            flags=cv2.CASCADE_SCALE_IMAGE
        )

        if len(upper_body) >= 1:
            self.integrity["extra-people-found"].append(datetime.now())

        for (x, y, w, h) in upper_body:
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 1)
            cv2.putText(
                frame,
                "Upper Body Detected",
                (x + 5, y + 15),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 0),
                2
            )

        result.write(frame)

    def get_integrity(self):
        return self.integrity