"""
Snoop AI Monitor Server
=======================
Standalone Flask server for real-time monitoring and anomaly detection.
Provides REST API endpoints for frame analysis and cheat score calculation.

Ports: 5001 (default)
Environment: AIMONITOR_PORT (optional)
"""

import os
import sys
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

# Import monitoring routes
from monitoring_service import create_monitoring_routes

# Create Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for cross-origin requests

# Register monitoring routes
create_monitoring_routes(app)

# Health check endpoint
@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "AIMonitor",
        "version": "1.0"
    }

# Root endpoint
@app.route('/', methods=['GET'])
def root():
    """Root endpoint."""
    return {
        "service": "Snoop AI Monitor",
        "endpoints": {
            "health": "GET /health",
            "start_session": "POST /api/monitoring/start_session",
            "analyze_frame": "POST /api/monitoring/analyze_frame",
            "get_anomalies": "GET /api/monitoring/get_anomalies",
            "end_session": "POST /api/monitoring/end_session",
            "cleanup_session": "POST /api/monitoring/cleanup_session",
        }
    }

if __name__ == "__main__":
    # Get port from environment or use default
    port = int(os.getenv('AIMONITOR_PORT', 5001))
    
    print(f"🚀 Starting Snoop AI Monitor Server on port {port}...")
    print(f"📊 API Base: http://127.0.0.1:{port}/api/monitoring")
    print()
    
    # Run Flask server
    app.run(host='127.0.0.1', port=port, debug=False, threaded=True)
