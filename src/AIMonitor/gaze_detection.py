
"""
Snoop AI Monitor — Gaze Detection (Final Config-Based Version)
=============================================================

✔ Uses config-based head pose thresholds
✔ Accurate blink (EAR) and talking (MAR)
✔ Gaze + head pose fusion
✔ Temporal smoothing
✔ Timer-based anomaly detection
✔ Crash-safe head pose
"""

import time
import cv2
import numpy as np
import mediapipe as mp

from config import (
    GAZE_AWAY_DURATION_THRESHOLD,
    GAZE_LEFT_THRESHOLD,
    GAZE_RIGHT_THRESHOLD,
    GAZE_DOWN_THRESHOLD,
    HEAD_YAW_LEFT,
    HEAD_YAW_RIGHT,
    HEAD_PITCH_DOWN,
    COLOR_GAZE_TEXT,
)

mp_face_mesh = mp.solutions.face_mesh


class GazeDetector:

    def __init__(self):
        self.face_mesh = mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.6,
            min_tracking_confidence=0.6,
        )

        # smoothing
        self._history = []
        self._history_size = 5

        self.blink_history = []
        self.mouth_history = []

        # timers
        self._away_start = None
        self._blink_start = None
        self._mouth_start = None

    # ─────────────────────────────────────────────

    def detect(self, frame):

        h, w, _ = frame.shape
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb)

        events = []
        direction = "looking_at_screen"
        blinking = False
        talking = False

        if results.multi_face_landmarks:
            lm = results.multi_face_landmarks[0].landmark

            direction = self._classify_gaze(lm, w, h)
            blinking = self._check_blink(lm, w, h)
            talking = self._check_mouth(lm, w, h)

        #  SMOOTHING (gaze)
        self._history.append(direction)
        if len(self._history) > self._history_size:
            self._history.pop(0)

        direction = max(set(self._history), key=self._history.count)

        #  SMOOTHING (blink)
        self.blink_history.append(blinking)
        if len(self.blink_history) > 5:
            self.blink_history.pop(0)
        blinking = sum(self.blink_history) > 3

        # SMOOTHING (mouth)
        self.mouth_history.append(talking)
        if len(self.mouth_history) > 5:
            self.mouth_history.pop(0)
        talking = sum(self.mouth_history) > 3

        # ───── GAZE TIMER ─────
        if direction != "looking_at_screen":

            if self._away_start is None:
                self._away_start = time.time()

            elif time.time() - self._away_start > GAZE_AWAY_DURATION_THRESHOLD:
                events.append({
                    "event_type": f"gaze_{direction}",
                    "confidence": 1.0,
                    "severity": "medium"
                })
                self._away_start = time.time()

        else:
            self._away_start = None

        # ───── BLINK TIMER ─────
        if blinking:
            if self._blink_start is None:
                self._blink_start = time.time()

            elif time.time() - self._blink_start > 2.0:
                events.append({
                    "event_type": "eyes_closed_long",
                    "confidence": 1.0,
                    "severity": "low"
                })
                self._blink_start = time.time()
        else:
            self._blink_start = None

        # ───── TALKING TIMER ─────
        if talking:
            if self._mouth_start is None:
                self._mouth_start = time.time()

            elif time.time() - self._mouth_start > 2.0:
                events.append({
                    "event_type": "talking_detected",
                    "confidence": 1.0,
                    "severity": "medium"
                })
                self._mouth_start = time.time()
        else:
            self._mouth_start = None

        # ───── DISPLAY ─────
        label = direction.replace("_", " ").title()

        if blinking:
            label += " | Eyes Closed"
        if talking:
            label += " | Talking"

        cv2.putText(
            frame,
            f"Gaze: {label}",
            (15, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            COLOR_GAZE_TEXT,
            2
        )

        return frame, direction, events

    # ─────────────────────────────────────────────

    def _classify_gaze(self, lm, w, h):

        left_ratio = self._iris_ratio(lm, w, [33,133], [468,469,470,471,472])
        right_ratio = self._iris_ratio(lm, w, [362,263], [473,474,475,476,477])

        iris_ratio = (left_ratio + right_ratio) / 2

        pitch, yaw = self._head_pose(lm, w, h)

        #  CONFIG-BASED LOGIC (YOUR REQUIREMENT)
        if yaw < HEAD_YAW_LEFT:
            return "looking_left"

        if yaw > HEAD_YAW_RIGHT:
            return "looking_right"

        if pitch > HEAD_PITCH_DOWN:
            return "looking_down"

        # fallback using iris
        if iris_ratio < GAZE_LEFT_THRESHOLD:
            return "looking_left"

        if iris_ratio > GAZE_RIGHT_THRESHOLD:
            return "looking_right"

        return "looking_at_screen"

    # ─────────────────────────────────────────────

    def _iris_ratio(self, lm, w, eye_idx, iris_idx):

        try:
            left = lm[eye_idx[0]].x * w
            right = lm[eye_idx[1]].x * w
            iris = np.mean([lm[i].x * w for i in iris_idx])

            if abs(right - left) < 1e-6:
                return 0.5

            return (iris - left) / (right - left)

        except:
            return 0.5

    # ─────────────────────────────────────────────

    def _check_blink(self, lm, w, h):

        def ear(p1, p2, t, b):
            p1 = np.array([lm[p1].x*w, lm[p1].y*h])
            p2 = np.array([lm[p2].x*w, lm[p2].y*h])

            width = np.linalg.norm(p1 - p2)

            heights = []
            for i in range(3):
                top = np.array([lm[t[i]].x*w, lm[t[i]].y*h])
                bot = np.array([lm[b[i]].x*w, lm[b[i]].y*h])
                heights.append(np.linalg.norm(top - bot))

            height = np.mean(heights)

            return height / width if width > 0 else 1

        left = ear(33,133,[159,158,157],[145,144,153])
        right = ear(362,263,[386,385,384],[374,373,380])

        return (left + right)/2 < 0.18

    # ─────────────────────────────────────────────

    def _check_mouth(self, lm, w, h):

        try:
            left = np.array([lm[78].x*w, lm[78].y*h])
            right = np.array([lm[308].x*w, lm[308].y*h])

            width = np.linalg.norm(left - right)

            heights = []
            for t, b in zip([13,12,11],[14,15,16]):
                top = np.array([lm[t].x*w, lm[t].y*h])
                bot = np.array([lm[b].x*w, lm[b].y*h])
                heights.append(np.linalg.norm(top - bot))

            height = np.mean(heights)

            return (height / width) > 0.35 if width > 0 else False

        except:
            return False

    # ─────────────────────────────────────────────

    def _head_pose(self, lm, w, h):

        try:
            image_points = np.array([
                (lm[1].x*w, lm[1].y*h),
                (lm[33].x*w, lm[33].y*h),
                (lm[263].x*w, lm[263].y*h),
                (lm[61].x*w, lm[61].y*h),
                (lm[291].x*w, lm[291].y*h),
                (lm[152].x*w, lm[152].y*h)
            ], dtype="double")

            if np.isnan(image_points).any():
                return 0, 0

            model_points = np.array([
                (0,0,0),(-30,-30,-30),(30,-30,-30),
                (-40,40,-30),(40,40,-30),(0,70,-20)
            ])

            focal = w
            center = (w/2, h/2)

            camera_matrix = np.array([
                [focal,0,center[0]],
                [0,focal,center[1]],
                [0,0,1]
            ], dtype="double")

            dist = np.zeros((4,1))

            success, rvec, _ = cv2.solvePnP(
                model_points,
                image_points,
                camera_matrix,
                dist
            )

            if not success:
                return 0, 0

            rmat, _ = cv2.Rodrigues(rvec)
            angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)

            pitch, yaw, _ = angles

            return pitch, yaw

        except:
            return 0, 0