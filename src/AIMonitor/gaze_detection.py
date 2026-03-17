# """
# Snoop AI Monitor — Gaze / Head-Pose Detection Module
# =====================================================
# Uses MediaPipe FaceMesh (468 landmarks) to estimate where the student
# is looking.

# Directions detected:
#     looking_at_screen, looking_left, looking_right,
#     looking_down, looking_away

# If the student looks away from the screen for longer than
# GAZE_AWAY_DURATION_THRESHOLD seconds an anomaly event is generated.
# """

# import time
# import cv2
# import numpy as np
# import mediapipe.python.solutions.face_mesh as mp_face_mesh

# from config import (
#     GAZE_AWAY_DURATION_THRESHOLD,
#     GAZE_LEFT_THRESHOLD,
#     GAZE_RIGHT_THRESHOLD,
#     GAZE_DOWN_THRESHOLD,
#     HEAD_LEFT_THRESHOLD,
#     HEAD_RIGHT_THRESHOLD,
#     HEAD_DOWN_THRESHOLD,
#     COLOR_GAZE_TEXT,
#     BLINK_RATIO_THRESHOLD,
#     MAX_BLINK_DURATION
# )

# # MediaPipe FaceMesh setup
# _mp_face_mesh = mp_face_mesh

# # Key landmark indices
# _LEFT_EYE_INDICES   = [33, 133]          # left corner, right corner
# _RIGHT_EYE_INDICES  = [362, 263]
# _LEFT_IRIS_INDICES  = [468, 469, 470, 471, 472]
# _RIGHT_IRIS_INDICES = [473, 474, 475, 476, 477]
# _NOSE_TIP_INDEX     = 1

# # Indices for Eye Aspect Ratio (EAR)
# _LEFT_EYE_TOP = [159, 158, 157]
# _LEFT_EYE_BOT = [145, 144, 153]
# _RIGHT_EYE_TOP = [386, 385, 384]
# _RIGHT_EYE_BOT = [374, 373, 380]

# # Indices for Mouth Aspect Ratio (MAR)
# _MOUTH_LEFT = 78
# _MOUTH_RIGHT = 308
# _MOUTH_TOP = [13, 12, 11]
# _MOUTH_BOT = [14, 15, 16]


# class GazeDetector:
#     """Real-time gaze direction, blink, and mouth movement estimation via FaceMesh."""

#     def __init__(self):
#         self.face_mesh = _mp_face_mesh.FaceMesh(
#             max_num_faces=1,
#             refine_landmarks=True,       # enables iris landmarks
#             min_detection_confidence=0.5,
#             min_tracking_confidence=0.5,
#         )
#         self._away_start: float | None = None
#         self._last_direction = "looking_at_screen"
        
#         # Blink & Mouth tracking
#         self._blink_start: float | None = None
#         self._mouth_open_start: float | None = None

#     # ── public API ────────────────────────────────────────────────────

#     def detect(self, frame: np.ndarray) -> tuple[np.ndarray, str, list[dict]]:
#         """
#         Estimate gaze direction, blink duration, and mouth state.

#         Returns
#         -------
#         annotated_frame : np.ndarray
#         gaze_status     : str
#         events          : list[dict]
#         """
#         h, w, _ = frame.shape
#         rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
#         results = self.face_mesh.process(rgb)

#         events: list[dict] = []
#         is_blinking = False
#         is_talking = False

#         if not results.multi_face_landmarks:
#             direction = "looking_away"
#         else:
#             landmarks = results.multi_face_landmarks[0].landmark
#             direction = self._classify_gaze(landmarks, w, h)
#             is_blinking = self._check_blink(landmarks)
#             is_talking = self._check_mouth(landmarks)

#         self._last_direction = direction

#         # ── sustained off-screen timer ────────────────────────────────
#         if direction != "looking_at_screen":
#             if self._away_start is None:
#                 self._away_start = time.time()
#             elif time.time() - self._away_start > GAZE_AWAY_DURATION_THRESHOLD:
#                 events.append({
#                     "event_type": f"gaze_{direction}",
#                     "confidence": 1.0,
#                 })
#                 self._away_start = time.time()   # reset to avoid spam
#         else:
#             self._away_start = None

#         # ── Blink timer (prolonged eye closure) ───────────────────────
#         if is_blinking:
#             if self._blink_start is None:
#                 self._blink_start = time.time()
#             elif time.time() - self._blink_start > MAX_BLINK_DURATION:
#                 events.append({
#                     "event_type": "prolonged_eyes_closed",
#                     "confidence": 1.0,
#                 })
#                 self._blink_start = time.time()
#         else:
#             self._blink_start = None

#         # ── Mouth Movement timer ──────────────────────────────────────
#         if is_talking:
#             if self._mouth_open_start is None:
#                 self._mouth_open_start = time.time()
#             elif time.time() - self._mouth_open_start > 2.0: # 2s of talking
#                 events.append({
#                     "event_type": "mouth_movement_detected",
#                     "confidence": 1.0,
#                 })
#                 self._mouth_open_start = time.time()
#         else:
#             self._mouth_open_start = None

#         # ── overlay ──────────────────────────────────────────────────
#         label = direction.replace("_", " ").title()
#         if is_blinking:
#             label += " (Eyes Closed)"
#         elif is_talking:
#             label += " (Talking)"
            
#         cv2.putText(frame, f"Face: {label}", (15, 35),
#                     cv2.FONT_HERSHEY_SIMPLEX, 0.75, COLOR_GAZE_TEXT, 2)

#         return frame, direction, events

#     # ── internals ─────────────────────────────────────────────────────

#     def _classify_gaze(self, landmarks, w: int, h: int) -> str:
#         """Combine iris ratio and nose position to decide finding direction."""
#         iris_ratio = self._iris_horizontal_ratio(landmarks, w)
#         nose_x, nose_y = self._nose_normalised(landmarks, w, h)

#         # Iris-based left/right
#         if iris_ratio < GAZE_LEFT_THRESHOLD:
#             return "looking_left"
#         if iris_ratio > GAZE_RIGHT_THRESHOLD:
#             return "looking_right"

#         # Head-pose fallback
#         if nose_x < HEAD_LEFT_THRESHOLD:
#             return "looking_left"
#         if nose_x > HEAD_RIGHT_THRESHOLD:
#             return "looking_right"
#         if nose_y > HEAD_DOWN_THRESHOLD:
#             return "looking_down"

#         return "looking_at_screen"

#     def _check_blink(self, landmarks) -> bool:
#         """Calculate Eye Aspect Ratio (EAR) to detect blinking/closed eyes."""
#         def eye_aspect_ratio(corner1, corner2, tops, bots):
#             width = np.linalg.norm([landmarks[corner1].x - landmarks[corner2].x, 
#                                    landmarks[corner1].y - landmarks[corner2].y])
#             height = np.mean([np.linalg.norm([landmarks[t].x - landmarks[b].x, 
#                                              landmarks[t].y - landmarks[b].y]) 
#                               for t, b in zip(tops, bots)])
#             if width < 1e-6: return 1.0
#             return height / width

#         left_ear = eye_aspect_ratio(_LEFT_EYE_INDICES[0], _LEFT_EYE_INDICES[1], _LEFT_EYE_TOP, _LEFT_EYE_BOT)
#         right_ear = eye_aspect_ratio(_RIGHT_EYE_INDICES[0], _RIGHT_EYE_INDICES[1], _RIGHT_EYE_TOP, _RIGHT_EYE_BOT)
        
#         avg_ear = (left_ear + right_ear) / 2.0
#         return avg_ear < BLINK_RATIO_THRESHOLD

#     def _check_mouth(self, landmarks) -> bool:
#         """Calculate Mouth Aspect Ratio (MAR) to detect if mouth is open/talking."""
#         mouth_width = np.linalg.norm([landmarks[_MOUTH_LEFT].x - landmarks[_MOUTH_RIGHT].x, 
#                                       landmarks[_MOUTH_LEFT].y - landmarks[_MOUTH_RIGHT].y])
#         mouth_height = np.mean([np.linalg.norm([landmarks[t].x - landmarks[b].x, 
#                                                 landmarks[t].y - landmarks[b].y]) 
#                                 for t, b in zip(_MOUTH_TOP, _MOUTH_BOT)])
        
#         if mouth_width < 1e-6: return False
        
#         # If height/width ratio is > 0.15, mouth is considered open/moving
#         return (mouth_height / mouth_width) > 0.15

#     @staticmethod
#     def _iris_horizontal_ratio(landmarks, w: int) -> float:
#         """
#         Return a 0-1 ratio of where the left iris sits between the left
#         and right corners of the left eye.  0 → far left, 1 → far right.
#         """
#         try:
#             left_corner  = landmarks[_LEFT_EYE_INDICES[0]].x * w
#             right_corner = landmarks[_LEFT_EYE_INDICES[1]].x * w
#             iris_x = np.mean([landmarks[i].x * w for i in _LEFT_IRIS_INDICES])
#             denom = right_corner - left_corner
#             if abs(denom) < 1e-6:
#                 return 0.5
#             return (iris_x - left_corner) / denom
#         except (IndexError, AttributeError):
#             return 0.5

#     @staticmethod
#     def _nose_normalised(landmarks, w: int, h: int) -> tuple[float, float]:
#         """Return normalised (x, y) of the nose tip."""
#         nose = landmarks[_NOSE_TIP_INDEX]
#         return nose.x, nose.y
"""
Snoop AI Monitor — Improved Gaze / Head Pose Detection
=====================================================

Features
--------
• Iris-based gaze estimation (both eyes)
• Head pose estimation (solvePnP)
• Blink detection (EAR)
• Mouth movement detection (MAR)
• Temporal smoothing
• Timer-based anomaly detection
"""

import time
import cv2
import numpy as np
import mediapipe.python.solutions.face_mesh as mp_face_mesh

from config import (
    GAZE_AWAY_DURATION_THRESHOLD,
    GAZE_LEFT_THRESHOLD,
    GAZE_RIGHT_THRESHOLD,
    HEAD_LEFT_THRESHOLD,
    HEAD_RIGHT_THRESHOLD,
    HEAD_DOWN_THRESHOLD,
    COLOR_GAZE_TEXT,
    BLINK_RATIO_THRESHOLD,
    MAX_BLINK_DURATION
)

_mp_face_mesh = mp_face_mesh

# Landmark indices
_LEFT_EYE = [33, 133]
_RIGHT_EYE = [362, 263]

_LEFT_IRIS = [468, 469, 470, 471, 472]
_RIGHT_IRIS = [473, 474, 475, 476, 477]

_NOSE_TIP = 1

# EAR landmarks
_LEFT_EYE_TOP = [159, 158, 157]
_LEFT_EYE_BOT = [145, 144, 153]

_RIGHT_EYE_TOP = [386, 385, 384]
_RIGHT_EYE_BOT = [374, 373, 380]

# Mouth landmarks
_MOUTH_LEFT = 78
_MOUTH_RIGHT = 308
_MOUTH_TOP = [13, 12, 11]
_MOUTH_BOT = [14, 15, 16]


class GazeDetector:

    def __init__(self):

        self.face_mesh = _mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

        self._away_start = None
        self._blink_start = None
        self._mouth_start = None

        # smoothing
        self._history = []
        self._history_size = 5


    def detect(self, frame):

        h, w, _ = frame.shape

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb)

        events = []
        direction = "looking_at_screen"
        blinking = False
        talking = False

        if not results.multi_face_landmarks:
            direction = "looking_away"

        else:

            landmarks = results.multi_face_landmarks[0].landmark

            direction = self._classify_gaze(landmarks, w, h)
            blinking = self._check_blink(landmarks)
            talking = self._check_mouth(landmarks)

        # temporal smoothing
        self._history.append(direction)
        if len(self._history) > self._history_size:
            self._history.pop(0)

        direction = max(set(self._history), key=self._history.count)

        # gaze anomaly timer
        if direction != "looking_at_screen":

            if self._away_start is None:
                self._away_start = time.time()

            elif time.time() - self._away_start > GAZE_AWAY_DURATION_THRESHOLD:

                events.append({
                    "event_type": f"gaze_{direction}",
                    "confidence": 1.0
                })

                self._away_start = time.time()

        else:
            self._away_start = None

        # blink timer
        if blinking:

            if self._blink_start is None:
                self._blink_start = time.time()

            elif time.time() - self._blink_start > MAX_BLINK_DURATION:

                events.append({
                    "event_type": "prolonged_eyes_closed",
                    "confidence": 1.0
                })

                self._blink_start = time.time()

        else:
            self._blink_start = None

        # mouth movement timer
        if talking:

            if self._mouth_start is None:
                self._mouth_start = time.time()

            elif time.time() - self._mouth_start > 2.0:

                events.append({
                    "event_type": "mouth_movement_detected",
                    "confidence": 1.0
                })

                self._mouth_start = time.time()

        else:
            self._mouth_start = None

        # overlay
        label = direction.replace("_", " ").title()

        if blinking:
            label += " (Eyes Closed)"

        if talking:
            label += " (Talking)"

        cv2.putText(
            frame,
            f"Gaze: {label}",
            (15, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.75,
            COLOR_GAZE_TEXT,
            2
        )

        return frame, direction, events


    def _classify_gaze(self, landmarks, w, h):

        left_ratio = self._iris_ratio(landmarks, w, _LEFT_EYE, _LEFT_IRIS)
        right_ratio = self._iris_ratio(landmarks, w, _RIGHT_EYE, _RIGHT_IRIS)

        iris_ratio = (left_ratio + right_ratio) / 2

        pitch, yaw = self._head_pose(landmarks, w, h)

        if iris_ratio < GAZE_LEFT_THRESHOLD or yaw < -20:
            return "looking_left"

        if iris_ratio > GAZE_RIGHT_THRESHOLD or yaw > 20:
            return "looking_right"

        if pitch > 18:
            return "looking_down"

        return "looking_at_screen"


    def _iris_ratio(self, landmarks, w, eye_idx, iris_idx):

        try:

            left = landmarks[eye_idx[0]].x * w
            right = landmarks[eye_idx[1]].x * w

            iris = np.mean([landmarks[i].x * w for i in iris_idx])

            denom = right - left

            if abs(denom) < 1e-6:
                return 0.5

            return (iris - left) / denom

        except:
            return 0.5


    def _check_blink(self, landmarks):

        def ear(c1, c2, tops, bots):

            width = np.linalg.norm([
                landmarks[c1].x - landmarks[c2].x,
                landmarks[c1].y - landmarks[c2].y
            ])

            height = np.mean([
                np.linalg.norm([
                    landmarks[t].x - landmarks[b].x,
                    landmarks[t].y - landmarks[b].y
                ]) for t, b in zip(tops, bots)
            ])

            if width < 1e-6:
                return 1

            return height / width


        left = ear(_LEFT_EYE[0], _LEFT_EYE[1], _LEFT_EYE_TOP, _LEFT_EYE_BOT)
        right = ear(_RIGHT_EYE[0], _RIGHT_EYE[1], _RIGHT_EYE_TOP, _RIGHT_EYE_BOT)

        return (left + right) / 2 < BLINK_RATIO_THRESHOLD


    def _check_mouth(self, landmarks):

        width = np.linalg.norm([
            landmarks[_MOUTH_LEFT].x - landmarks[_MOUTH_RIGHT].x,
            landmarks[_MOUTH_LEFT].y - landmarks[_MOUTH_RIGHT].y
        ])

        height = np.mean([
            np.linalg.norm([
                landmarks[t].x - landmarks[b].x,
                landmarks[t].y - landmarks[b].y
            ]) for t, b in zip(_MOUTH_TOP, _MOUTH_BOT)
        ])

        if width < 1e-6:
            return False

        return (height / width) > 0.15


    def _head_pose(self, landmarks, w, h):

        image_points = np.array([
            (landmarks[1].x * w, landmarks[1].y * h),      # nose tip
            (landmarks[33].x * w, landmarks[33].y * h),    # left eye corner
            (landmarks[263].x * w, landmarks[263].y * h),  # right eye corner
            (landmarks[61].x * w, landmarks[61].y * h),    # mouth left
            (landmarks[291].x * w, landmarks[291].y * h),  # mouth right
            (landmarks[152].x * w, landmarks[152].y * h)   # chin
        ], dtype="double")


        model_points = np.array([
            (0.0, 0.0, 0.0),       # nose
            (-30.0, -30.0, -30.0), # left eye
            (30.0, -30.0, -30.0),  # right eye
            (-40.0, 40.0, -30.0),  # mouth left
            (40.0, 40.0, -30.0),   # mouth right
            (0.0, 70.0, -20.0)     # chin
        ])


        focal_length = w
        center = (w/2, h/2)

        camera_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1]
        ], dtype="double")

        dist_coeffs = np.zeros((4,1))


        success, rotation_vec, translation_vec = cv2.solvePnP(
            model_points,
            image_points,
            camera_matrix,
            dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE
        )

        rmat, _ = cv2.Rodrigues(rotation_vec)

        angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)

        pitch, yaw, roll = angles

        return pitch, yaw