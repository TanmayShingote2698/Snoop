/**
 * Snoop AI Monitor — Client-Side Monitoring
 * ==========================================
 * Captures video/audio and sends frames to backend for AI analysis.
 * 
 * Usage:
 *   const monitor = new SnoopMonitor('test-id', 'student@email.com');
 *   await monitor.requestPermissions();
 *   monitor.startMonitoring();
 */

class SnoopMonitor {
  constructor(testId, studentEmail, options = {}) {
    this.testId = testId;
    this.studentEmail = studentEmail;
    this.sessionId = `${testId}-${studentEmail}-${Date.now()}`;
    
    // Configuration
    this.frameInterval = options.frameInterval || 1000; // ms between frames
    this.apiBaseUrl = options.apiBaseUrl || '/api';
    this.frameQuality = options.frameQuality || 0.7; // for JPEG compression
    this.canvasWidth = options.canvasWidth || 640;
    this.canvasHeight = options.canvasHeight || 480;
    
    // State
    this.isMonitoring = false;
    this.hardwareStream = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.frameCount = 0;
    this.anomaliesDetected = [];
    this.setupComplete = false;
    
    // Callbacks
    this.onAnomalyDetected = options.onAnomalyDetected || null;
    this.onStatusChange = options.onStatusChange || null;
    this.onError = options.onError || null;
  }

  /**
   * Request camera and microphone permissions from user
   */
  async requestPermissions() {
    try {
      this.log("📹 Requesting camera and microphone permissions...");
      this.updateStatus("Requesting device access...", "warning");
      
      const constraints = {
        video: {
          width: { ideal: this.canvasWidth },
          height: { ideal: this.canvasHeight },
          facingMode: "user"
        },
        audio: true // Enable audio monitoring
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.hardwareStream = stream;
      this.log(" Permissions granted!");
      
      return true;
    } catch (error) {
      const errorMsg = `Permission denied: ${error.message}`;
      this.log(` ${errorMsg}`);
      this.updateStatus(errorMsg, "error");
      if (this.onError) this.onError(error);
      throw error;
    }
  }

  /**
   * Initialize hidden video/canvas elements for frame capture
   */
  setupCaptureElements() {
    if (this.setupComplete) return;
    
    // Create hidden video element
    this.videoElement = document.createElement('video');
    this.videoElement.style.display = 'none';
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.srcObject = this.hardwareStream;
    document.body.appendChild(this.videoElement);
    
    // Create hidden canvas for frame capture
    this.canvasElement = document.createElement('canvas');
    this.canvasElement.style.display = 'none';
    this.canvasElement.width = this.canvasWidth;
    this.canvasElement.height = this.canvasHeight;
    document.body.appendChild(this.canvasElement);
    
    this.setupComplete = true;
    this.log("✓ Capture elements initialized");
  }

  /**
   * Start monitoring session with backend
   */
  async startMonitoringSession() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/monitoring/start_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          test_id: this.testId,
          student_email: this.studentEmail
        })
      });
      
      const result = await response.json();
      if (result.status !== "success") {
        throw new Error(result.message);
      }
      
      this.log("✓ Monitoring session started");
      return true;
    } catch (error) {
      this.log(`❌ Failed to start session: ${error.message}`);
      if (this.onError) this.onError(error);
      throw error;
    }
  }

  /**
   * Start continuous frame capture and analysis
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.warn("Monitoring already active");
      return;
    }
    
    this.setupCaptureElements();
    this.isMonitoring = true;
    this.updateStatus("🔴 MONITORING ACTIVE - Camera and Mic Recording", "active");
    this.log("🎥 Started frame capture and analysis");
    
    // Start frame capture loop
    this.frameInterval = setInterval(() => {
      if (this.isMonitoring && this.videoElement) {
        this.captureAndAnalyzeFrame();
      }
    }, this.frameInterval);
  }

  /**
   * Capture current video frame and send to backend
   */
  async captureAndAnalyzeFrame() {
    try {
      if (!this.videoElement || !this.canvasElement) return;
      
      // Draw video frame to canvas
      const ctx = this.canvasElement.getContext('2d');
      ctx.drawImage(
        this.videoElement,
        0, 0,
        this.canvasElement.width,
        this.canvasElement.height
      );
      
      // Convert canvas to base64 JPEG
      const frameDataBase64 = this.canvasElement.toDataURL('image/jpeg', this.frameQuality)
        .replace('data:image/jpeg;base64,', '');
      
      // Send to backend for analysis
      const response = await fetch(`${this.apiBaseUrl}/monitoring/analyze_frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          frame_data: frameDataBase64
        })
      });
      
      const result = await response.json();
      this.frameCount++;
      
      // Handle detected anomalies
      if (result.anomalies && result.anomalies.length > 0) {
        this.onAnomaliesDetected(result.anomalies);
      }
      
    } catch (error) {
      console.error("Frame capture error:", error);
    }
  }

  /**
   * Process detected anomalies
   */
  onAnomaliesDetected(anomalies) {
    for (const anomaly of anomalies) {
      this.anomaliesDetected.push(anomaly);
      
      // Log to console
      console.warn(`[ANOMALY] ${anomaly.type}`, anomaly);
      
      // Trigger callback
      if (this.onAnomalyDetected) {
        this.onAnomalyDetected(anomaly);
      }
    }
  }

  /**
   * Stop monitoring and process results
   */
  async stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    clearInterval(this.frameInterval);
    
    this.updateStatus("Processing monitoring data...", "processing");
    this.log("⏹️ Stopped frame capture");
    
    // End session with backend
    try {
      const response = await fetch(`${this.apiBaseUrl}/monitoring/end_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: this.sessionId })
      });
      
      const result = await response.json();
      
      if (result.status === "success") {
        this.cheatScore = result.cheat_score;
        this.anomalyBreakdown = result.anomaly_breakdown;
        this.log(`✓ Session ended. Cheat Score: ${this.cheatScore}`);
        this.updateStatus(`Monitoring Complete - Cheat Score: ${this.cheatScore}`, "complete");
        return result;
      }
    } catch (error) {
      this.log(`❌ Error ending session: ${error.message}`);
      if (this.onError) this.onError(error);
    }
  }

  /**
   * Stop hardware stream and cleanup
   */
  cleanupResources() {
    if (this.hardwareStream) {
      this.hardwareStream.getTracks().forEach(track => track.stop());
    }
    
    if (this.videoElement && this.videoElement.parentNode) {
      this.videoElement.parentNode.removeChild(this.videoElement);
    }
    
    if (this.canvasElement && this.canvasElement.parentNode) {
      this.canvasElement.parentNode.removeChild(this.canvasElement);
    }
    
    this.log("🧹 Resources cleaned up");
  }

  /**
   * Get all anomalies detected during session
   */
  getAnomalies() {
    return this.anomaliesDetected;
  }

  /**
   * Get current cheat score
   */
  getCheatScore() {
    return this.cheatScore || 0;
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    return {
      sessionId: this.sessionId,
      framesCaptured: this.frameCount,
      anomaliesDetected: this.anomaliesDetected.length,
      cheatScore: this.cheatScore || 0,
      anomalyBreakdown: this.anomalyBreakdown || {}
    };
  }

  /**
   * Update monitoring status in UI
   */
  updateStatus(message, state = "info") {
    const statusEl = document.getElementById('ai-monitor-status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `ai-monitor-status status-${state}`;
    }
    
    if (this.onStatusChange) {
      this.onStatusChange(message, state);
    }
  }

  /**
   * Internal logging
   */
  log(message) {
    console.log(`[SnoopMonitor] ${message}`);
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SnoopMonitor;
}
