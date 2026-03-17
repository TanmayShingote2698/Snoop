"""
Snoop AI Monitor — Monitoring Service
======================================
Real-time monitoring service for proctoring during student tests.
Analyzes video frames via WebSocket and provides anomaly detection.

Endpoints:
  - POST /api/monitoring/start_session    - Initialize monitoring for a test
  - POST /api/monitoring/analyze_frame    - Submit frame for analysis
  - GET  /api/monitoring/get_anomalies    - Retrieve anomalies for session
  - POST /api/monitoring/end_session      - Finalize and calculate cheat score
"""

import sys
import os
import json
import base64
import cv2
import numpy as np
import traceback
from datetime import datetime
from threading import Lock
from collections import defaultdict

# Flask imports (for use in Flask app)
from flask import request

# Ensure the AIMonitor package is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import (
    YOLO_MODEL_PATH,
    YOLO_CONFIDENCE_THRESHOLD,
    TARGET_CLASSES,
    SUSPICIOUS_OBJECTS,
)
from event_logger import EventLogger
from object_detection import ObjectDetector
from face_detection import FaceDetector
from gaze_detection import GazeDetector
from audio_monitor import AudioMonitor

# ─────────────────────────────────────────────────────────
# MONITORING SESSION MANAGER
# ─────────────────────────────────────────────────────────

class MonitoringSessionManager:
    """Manages individual monitoring sessions for each test."""
    
    def __init__(self):
        self._sessions = {}  # session_id -> session_data
        self._lock = Lock()
        self._logger = EventLogger()
        
        # Initialize detectors
        self._object_detector = ObjectDetector()
        self._face_detector = FaceDetector()
        self._gaze_detector = GazeDetector()
        self._audio_monitor = AudioMonitor()
    
    def start_session(self, session_id: str, test_id: str, student_email: str) -> dict:
        """Initialize a new monitoring session."""
        with self._lock:
            if session_id in self._sessions:
                return {"status": "error", "message": "Session already exists"}
            
            self._sessions[session_id] = {
                "test_id": test_id,
                "student_email": student_email,
                "start_time": datetime.now().isoformat(),
                "anomalies": [],
                "frame_count": 0,
                "active": True,
            }
            
            # Start audio monitoring
            self._audio_monitor.start()
            
            return {
                "status": "success",
                "session_id": session_id,
                "message": "Monitoring session started"
            }
    
    def analyze_frame(self, session_id: str, frame_data_base64: str) -> dict:
        """Analyze a single video frame for anomalies."""
        with self._lock:
            if session_id not in self._sessions:
                return {"status": "error", "message": "Invalid session"}
            
            session = self._sessions[session_id]
            if not session["active"]:
                return {"status": "error", "message": "Session not active"}
        
        try:
            # Decode base64 frame
            frame_data = base64.b64decode(frame_data_base64)
            nparr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                return {"status": "error", "message": "Invalid frame data"}
            
            anomalies_detected = []
            
            # Run object detection (for suspicious objects)
            frame, obj_events = self._object_detector.detect(frame)
            for event in obj_events:
                anomaly = {
                    "type": event["event_type"],
                    "confidence": event["confidence"],
                    "timestamp": datetime.now().isoformat()
                }
                anomalies_detected.append(anomaly)
                self._logger.log_event(anomaly["type"], anomaly["confidence"])
            
            # Run face detection
            frame, face_status, face_events = self._face_detector.detect(frame)
            for event in face_events:
                anomaly = {
                    "type": event["event_type"],
                    "confidence": event["confidence"],
                    "timestamp": datetime.now().isoformat()
                }
                anomalies_detected.append(anomaly)
                self._logger.log_event(anomaly["type"], anomaly["confidence"])
            
            # Run gaze detection
            frame, direction, gaze_events = self._gaze_detector.detect(frame)
            for event in gaze_events:
                anomaly = {
                    "type": event["event_type"],
                    "confidence": event["confidence"],
                    "timestamp": datetime.now().isoformat()
                }
                anomalies_detected.append(anomaly)
                self._logger.log_event(anomaly["type"], anomaly["confidence"])
            
            # Store anomalies
            with self._lock:
                session = self._sessions[session_id]
                session["anomalies"].extend(anomalies_detected)
                session["frame_count"] += 1
            
            return {
                "status": "success",
                "anomalies_detected": len(anomalies_detected),
                "anomalies": anomalies_detected,
                "frame_number": session["frame_count"]
            }
        
        except Exception as e:
            print(f"[MonitoringService] Frame analysis error: {e}")
            traceback.print_exc()
            return {
                "status": "error",
                "message": f"Frame analysis failed: {str(e)}"
            }
    
    def get_anomalies(self, session_id: str) -> dict:
        """Retrieve all anomalies for a session."""
        with self._lock:
            if session_id not in self._sessions:
                return {"status": "error", "message": "Invalid session"}
            
            session = self._sessions[session_id]
            return {
                "status": "success",
                "session_id": session_id,
                "anomalies": session["anomalies"],
                "frame_count": session["frame_count"],
                "anomaly_count": len(session["anomalies"])
            }
    
    def calculate_cheat_score(self, session_id: str) -> dict:
        """
        Calculate cheat score based on anomalies detected during session.
        
        Scoring system (0-100, lower is better):
        - Each suspicious object: +10 points
        - No face detected: +15 points per occurrence
        - Gaze away from screen: +8 points per occurrence
        - Looking away (left/right): +5 points per occurrence
        - Multiple anomalies compound the score
        """
        with self._lock:
            if session_id not in self._sessions:
                return {"status": "error", "message": "Invalid session"}
            
            session = self._sessions[session_id]
            anomalies = session["anomalies"]
        
        # Initialize score tracking
        cheat_score = 0
        anomaly_breakdown = defaultdict(int)
        
        # Count anomalies by type
        for anomaly in anomalies:
            atype = anomaly.get("type", "unknown")
            anomaly_breakdown[atype] += 1
        
        # Calculate score based on anomaly types
        score_weights = {
            "suspicious_object_detected": 10,
            "no_face_detected": 15,
            "gaze_away_from_screen": 8,
            "gaze_looking_left": 5,
            "gaze_looking_right": 5,
            "gaze_down": 3,
            "multiple_persons_detected": 12,
            "phone_detected": 20,  # Most suspicious
            "book_detected": 8,
        }
        
        for atype, count in anomaly_breakdown.items():
            weight = score_weights.get(atype, 3)
            cheat_score += weight * count
        
        # Cap score at 100
        if cheat_score > 100:
            cheat_score = 100
        
        with self._lock:
            session["cheat_score"] = cheat_score
            session["anomaly_breakdown"] = dict(anomaly_breakdown)
            session["end_time"] = datetime.now().isoformat()
            session["active"] = False
        
        return {
            "status": "success",
            "session_id": session_id,
            "cheat_score": cheat_score,
            "anomaly_breakdown": dict(anomaly_breakdown),
            "total_anomalies": len(anomalies),
            "total_frames": session["frame_count"],
            "session_duration": session.get("end_time")
        }
    
    def end_session(self, session_id: str) -> dict:
        """Finalize session and return comprehensive report."""
        result = self.calculate_cheat_score(session_id)
        
        with self._lock:
            if session_id in self._sessions:
                session = self._sessions[session_id]
                result["test_id"] = session["test_id"]
                result["student_email"] = session["student_email"]
        
        # Stop audio monitoring
        self._audio_monitor.stop()
        
        return result
    
    def cleanup_session(self, session_id: str) -> dict:
        """Remove session from memory."""
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
                return {"status": "success", "message": "Session cleaned up"}
            return {"status": "error", "message": "Session not found"}


# Global session manager instance
_session_manager = MonitoringSessionManager()


# ─────────────────────────────────────────────────────────
# FLASK ENDPOINTS
# ─────────────────────────────────────────────────────────

def create_monitoring_routes(app):
    """
    Register monitoring endpoints with Flask app.
    
    Usage:
        from monitoring_service import create_monitoring_routes
        create_monitoring_routes(app)
    """
    
    @app.route('/api/monitoring', methods=['GET'])
    def monitoring_root():
        """Root monitoring info endpoint."""
        return {
            "status": "online",
            "service": "Snoop AI Monitoring Engine",
            "endpoints": [
                "/api/monitoring/start_session",
                "/api/monitoring/analyze_frame",
                "/api/monitoring/get_anomalies",
                "/api/monitoring/end_session"
            ]
        }
    
    @app.route('/api/monitoring/start_session', methods=['POST'])
    def start_session():
        """Start a new monitoring session."""
        data = request.get_json()
        session_id = data.get('session_id')
        test_id = data.get('test_id')
        student_email = data.get('student_email')
        
        if not all([session_id, test_id, student_email]):
            return {"status": "error", "message": "Missing required fields"}, 400
        
        result = _session_manager.start_session(session_id, test_id, student_email)
        return result
    
    @app.route('/api/monitoring/analyze_frame', methods=['POST'])
    def analyze_frame():
        """Submit a video frame for analysis."""
        data = request.get_json()
        session_id = data.get('session_id')
        frame_data = data.get('frame_data')
        
        if not session_id or not frame_data:
            return {"status": "error", "message": "Missing session_id or frame_data"}, 400
        
        result = _session_manager.analyze_frame(session_id, frame_data)
        return result
    
    @app.route('/api/monitoring/get_anomalies', methods=['GET'])
    def get_anomalies():
        """Retrieve anomalies for a session."""
        session_id = request.args.get('session_id')
        
        if not session_id:
            return {"status": "error", "message": "Missing session_id"}, 400
        
        result = _session_manager.get_anomalies(session_id)
        return result
    
    @app.route('/api/monitoring/end_session', methods=['POST'])
    def end_session():
        """End monitoring session and calculate cheat score."""
        data = request.get_json()
        session_id = data.get('session_id')
        
        if not session_id:
            return {"status": "error", "message": "Missing session_id"}, 400
        
        result = _session_manager.end_session(session_id)
        return result
    
    @app.route('/api/monitoring/cleanup_session', methods=['POST'])
    def cleanup():
        """Clean up session from memory."""
        data = request.get_json()
        session_id = data.get('session_id')
        
        if not session_id:
            return {"status": "error", "message": "Missing session_id"}, 400
        
        result = _session_manager.cleanup_session(session_id)
        return result


if __name__ == "__main__":
    # For testing
    print("[MonitoringService] Service initialized")
    print("Use create_monitoring_routes(app) to register endpoints")
