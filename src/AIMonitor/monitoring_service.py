import sys
import os
import base64
import cv2
import numpy as np
import traceback
import time
from datetime import datetime
from threading import Lock

from flask import request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from object_detection import ObjectDetector
from face_detection import FaceDetector
from gaze_detection import GazeDetector
from audio_monitor import AudioMonitor
from cheat_score_calculator import CheatScoreCalculator


class MonitoringSessionManager:

    def __init__(self):
        self._sessions = {}
        self._lock = Lock()

        self._object_detector = ObjectDetector()
        self._face_detector = FaceDetector()
        self._gaze_detector = GazeDetector()
        self._audio_monitor = AudioMonitor()

    # ─────────────────────────────────────────────

    def start_session(self, session_id, test_id, student_email):

        with self._lock:
            self._sessions[session_id] = {
                "test_id": test_id,
                "student_email": student_email,
                "start_time": datetime.now().isoformat(),
                "anomalies": [],
                "behavioral_data": {},   
                "frame_count": 0,
                "active": True,
            }

        self._audio_monitor.start()

        return {"status": "success", "session_id": session_id}

    # ─────────────────────────────────────────────

    def analyze_frame(self, session_id, frame_data_base64):

        if session_id not in self._sessions:
            return {"status": "error", "message": "Invalid session"}

        session = self._sessions[session_id]

        try:
            frame_data = base64.b64decode(frame_data_base64)
            nparr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                return {"status": "error", "message": "Invalid frame"}

            anomalies_detected = []

            # ───── OBJECT DETECTION ─────
            frame, obj_events = self._object_detector.detect(frame)
            anomalies_detected.extend(self._format_events(obj_events))

            # ───── FACE DETECTION ─────
            frame, _, face_events = self._face_detector.detect(frame)
            anomalies_detected.extend(self._format_events(face_events))

            # ───── GAZE DETECTION ─────
            frame, _, gaze_events = self._gaze_detector.detect(frame)
            anomalies_detected.extend(self._format_events(gaze_events))

            # ───── AUDIO ─────
            audio_events = self._audio_monitor.collect_events()
            anomalies_detected.extend(self._format_events(audio_events))

            # ───── STORE ─────
            with self._lock:
                session["anomalies"].extend(anomalies_detected)
                session["frame_count"] += 1

            return {
                "status": "success",
                "anomalies": anomalies_detected,
                "frame_number": session["frame_count"]
            }

        except Exception as e:
            print(f"[ERROR] {e}")
            traceback.print_exc()
            return {"status": "error", "message": str(e)}

    # ─────────────────────────────────────────────

    def _format_events(self, events):

        formatted = []

        for e in events:
            formatted.append({
                "type": e.get("event_type"),
                "confidence": e.get("confidence", 1.0),
                "timestamp": time.time() 
            })

        return formatted

    # ─────────────────────────────────────────────

    def update_behavior(self, session_id, behavioral_data):
        """Update behavioral violations (frontend → backend)"""

        if session_id not in self._sessions:
            return {"status": "error"}

        with self._lock:
            self._sessions[session_id]["behavioral_data"] = behavioral_data

        return {"status": "success"}

    # ─────────────────────────────────────────────

    def end_session(self, session_id):

        if session_id not in self._sessions:
            return {"status": "error"}

        session = self._sessions[session_id]

        # USE ADVANCED ENGINE
        engine = CheatScoreCalculator(time_window=10)

        result = engine.calculate(
            anomalies=session["anomalies"],
            behavioral_data=session.get("behavioral_data", {})
        )

        # Save results
        session["cheat_score"] = result["cheat_score"]
        session["risk_level"] = result["risk_level"]
        session["active"] = False

        # Stop audio
        self._audio_monitor.stop()

        return {
            "status": "success",
            "session_id": session_id,
            "test_id": session["test_id"],
            "student_email": session["student_email"],
            **result
        }


# GLOBAL INSTANCE
_session_manager = MonitoringSessionManager()


# ─────────────────────────────────────────────
# FLASK ROUTES
# ─────────────────────────────────────────────

def create_monitoring_routes(app):

    @app.route('/api/monitoring/start_session', methods=['POST'])
    def start_session():
        data = request.get_json()
        return _session_manager.start_session(
            data["session_id"],
            data["test_id"],
            data["student_email"]
        )

    @app.route('/api/monitoring/analyze_frame', methods=['POST'])
    def analyze_frame():
        data = request.get_json()
        return _session_manager.analyze_frame(
            data["session_id"],
            data["frame_data"]
        )

    @app.route('/api/monitoring/update_behavior', methods=['POST'])
    def update_behavior():
        data = request.get_json()
        return _session_manager.update_behavior(
            data["session_id"],
            data["behavioral_data"]
        )

    @app.route('/api/monitoring/end_session', methods=['POST'])
    def end_session():
        data = request.get_json()
        return _session_manager.end_session(data["session_id"])