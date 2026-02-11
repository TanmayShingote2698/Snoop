import cv2
import os
import threading
from flask import Flask, jsonify
from FaceRecognition import FaceRecognition
from LandmarkDetection import LandmarkDetection
from UpperBodyDetection import UpperBodyDetection
from MotionTracking import MotionTracking

app = Flask(__name__)

# ---------------- CONFIG ---------------- #
CAMERA_INDEX = 0
USER_ID = 1
FPS = 10
OUTPUT_VIDEO = "output.avi"
FRAME_SKIP = 3          # run heavy recognition every N frames
PORT = 5001             # New port for Anomaly Server
# ---------------------------------------- #

# ---------------- GLOBAL INITIALIZATION (WARM-UP) ---------------- #
print("Initializing AI Detectors (Pre-loading models)...")
# These are instantiated globally so they load their weights once on server start
fr = FaceRecognition()
ld = LandmarkDetection()
ud = UpperBodyDetection()
mt = MotionTracking()

# Camera object (initialized on demand to save power/privacy)
video_capture = None

is_monitoring = False
monitor_thread = None

def run_monitoring():
    global is_monitoring, video_capture
    
    # Check if video_capture is available, otherwise try opening
    if not video_capture or not video_capture.isOpened():
        video_capture = cv2.VideoCapture(CAMERA_INDEX)

    print("Monitoring started...")
    
    # We don't redefine fr, ld, etc. here anymore as they are global
    # Just need to ensure fr has the student encoding loaded
    
    # Create video writer locally for this session
    frame_width = int(video_capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(video_capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    result_writer = cv2.VideoWriter(
        OUTPUT_VIDEO,
        cv2.VideoWriter_fourcc(*"MJPG"),
        FPS,
        (frame_width, frame_height)
    )

    frame_count = 0

    while is_monitoring:
        ret, frame = video_capture.read()
        if not ret:
            break

        frame_count += 1
        if frame_count % FRAME_SKIP == 0:
            # Note: We now pass the global detectors
            fr.run(frame, result_writer)
            ld.run(frame, result_writer)
            ud.run(frame, result_writer)
            mt.run(frame, result_writer)

        cv2.imshow("Snoop AI Proctoring - ACTIVE", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            is_monitoring = False
            break

    result_writer.release()
    # OPTIONAL: Keep open or release? User says it remains on. 
    # To respect privacy, we release it here.
    if video_capture and video_capture.isOpened():
        video_capture.release()
        
    cv2.destroyAllWindows()
    print("Monitoring loop exited and camera released.")

@app.route('/health', methods=['GET'])
def health():
    # Attempt to check camera status safely
    is_open = False
    try:
        is_open = video_capture.isOpened()
    except:
        pass
    return jsonify({
        "status": "healthy", 
        "service": "AnomalyServer",
        "camera_open": is_open
    })

@app.route('/start', methods=['POST'])
def start():
    global is_monitoring, monitor_thread, video_capture
    if not is_monitoring:
        # Ensure camera is open for this session
        if not video_capture or not video_capture.isOpened():
            print("Opening webcam for new session...")
            video_capture = cv2.VideoCapture(CAMERA_INDEX)
            
        # Load user-specific image
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        PROJECT_ROOT = os.path.dirname(BASE_DIR)
        DATASET_DIR = os.path.join(PROJECT_ROOT, "dataset")
        USER_IMAGE_PATH = os.path.join(DATASET_DIR, f"{USER_ID}.jpg")
        
        try:
            fr.load_student(USER_IMAGE_PATH, USER_ID)
        except Exception as e:
            return jsonify({"status": "error", "message": f"Failed to load user image: {str(e)}"})

        is_monitoring = True
        monitor_thread = threading.Thread(target=run_monitoring)
        monitor_thread.start()
        return jsonify({"status": "success", "message": "Monitoring started"})
    return jsonify({"status": "error", "message": "Monitoring already running"})

@app.route('/stop', methods=['POST'])
def stop():
    global is_monitoring, video_capture
    if is_monitoring:
        is_monitoring = False
        if monitor_thread:
            monitor_thread.join()
        
        # Explicitly release camera to turn off the light
        if video_capture and video_capture.isOpened():
            video_capture.release()
            print("Webcam hardware released.")

        # Get integrity score from global objects
        integrity_results = {}
        integrity_results.update(fr.get_integrity())
        integrity_results.update(ld.get_integrity())
        integrity_results.update(ud.get_integrity())
        integrity_results.update(mt.get_integrity())

        score_values = [v for v in integrity_results.values() if isinstance(v, (int, float))]
        final_score = sum(score_values) / len(score_values) if score_values else 100
        
        return jsonify({
            "status": "success", 
            "score": final_score,
            "details": integrity_results
        })
    return jsonify({"status": "error", "message": "Monitoring is not running"})

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=PORT, debug=False)
