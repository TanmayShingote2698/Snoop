const express = require("express");
const path = require("path");
// Load environment variables from project root
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const expressLayouts = require("express-ejs-layouts");
const multer = require("multer");
const fs = require("fs");
const session = require("express-session");

const app = express();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Express body parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Support json bodies

// Session Configuration
app.use(session({
  secret: 'snoop-secret-key-123', // Change this in production
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

//EJS
app.use(expressLayouts);
app.set("view engine", "ejs");

// Middleware to expose flash messages from query params to EJS
app.use((req, res, next) => {
  // Check for flash messages in session first, then query params
  res.locals.success = req.session.successMessage || req.query.success || null;
  res.locals.error = req.session.errorMessage || req.query.error || null;
  res.locals.user = req.session.user || null; // Expose logged-in user to all views
  res.locals.upload = upload; // Expose upload middleware to routes
  
  // Clear flash messages after exposing them to prevent them from appearing on refresh
  // express-session will auto-detect the change and save it
  if (req.session.successMessage) {
    delete req.session.successMessage;
  }
  if (req.session.errorMessage) {
    delete req.session.errorMessage;
  }
  
  next();
});

// const logger = (req, res, next) => {
//   console.log("logger");
//   next();
// };

// Init middleware
// app.use(logger);

app.get("/api/members", (req, res) => {
  console.log("in api.members");
  res.send("something");
});

// Main route
app.use("/", require("./routers/mainRouter"));

// Teacher Router
app.use("/teacher", require("./routers/teacher").router);

// Student Router
app.use("/student", require("./routers/student"));

// AI Monitoring Proxy Routes - Forward to AIMonitor service
const request = require('request');
const AIMONITOR_PORT = process.env.AIMONITOR_PORT || 5001; // AIMonitor runs on port 5001

// Proxy: Monitoring Status
app.get('/api/monitoring', (req, res) => {
  const options = {
    url: `http://127.0.0.1:${AIMONITOR_PORT}/api/monitoring`,
    json: true
  };
  request.get(options, (error, response, body) => {
    if (error) {
      console.error('Monitoring status error:', error);
      return res.status(502).json({ error: 'AI Monitoring service unreachable' });
    }
    res.json(body);
  });
});

// Proxy: Start Monitoring Session
app.post('/api/monitoring/start_session', (req, res) => {
  const options = {
    url: `http://127.0.0.1:${AIMONITOR_PORT}/api/monitoring/start_session`,
    json: true,
    body: req.body
  };
  request.post(options, (error, response, body) => {
    if (error) {
      console.error('Monitoring start_session error:', error);
      return res.status(500).json({ error: 'Failed to start monitoring session' });
    }
    res.json(body);
  });
});

// Proxy: Analyze Frame
app.post('/api/monitoring/analyze_frame', (req, res) => {
  const options = {
    url: `http://127.0.0.1:${AIMONITOR_PORT}/api/monitoring/analyze_frame`,
    json: true,
    body: req.body
  };
  request.post(options, (error, response, body) => {
    if (error) {
      console.error('Monitoring analyze_frame error:', error);
      return res.status(500).json({ error: 'Failed to analyze frame', anomalies: [] });
    }
    res.json(body);
  });
});

// Proxy: End Session
app.post('/api/monitoring/end_session', (req, res) => {
  const options = {
    url: `http://127.0.0.1:${AIMONITOR_PORT}/api/monitoring/end_session`,
    json: true,
    body: req.body
  };
  request.post(options, (error, response, body) => {
    if (error) {
      console.error('Monitoring end_session error:', error);
      return res.status(500).json({ error: 'Failed to end monitoring session', cheat_score: 0 });
    }
    res.json(body);
  });
});

// Set static folder
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "index.html"));
// });

const PORT = process.env.PORT || 5000;

// Create HTTP server and initialize Socket.IO
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: { origin: "*" } // Adjust in production
});

// Pass io to router so it can be used in other files if needed
app.set('io', io);

// Handle Socket.IO connections
io.on('connection', (socket) => {
  console.log('⚡ A user connected via WebSocket:', socket.id);

  // Join a specific test room (e.g., student joining a test or teacher monitoring)
  socket.on('join_test_room', (testID) => {
    socket.join(testID);
    console.log(`📡 Socket ${socket.id} joined test room: ${testID}`);
  });

  // Handle student activity/violations
  socket.on('student_activity', (data) => {
    // data should contain { testID, studentEmail, activityType, timestamp, details }
    const { testID } = data;
    if (testID) {
      // Broadcast this activity to the teacher monitoring this specific test room
      io.to(testID).emit('live_activity_update', data);
      console.log(`🚨 Activity broadcasted in room ${testID}:`, data.activityType);
    }
  });

  // Handle student completion
  socket.on('student_submitted', (data) => {
    const { testID } = data;
    if (testID) {
      io.to(testID).emit('live_submission_update', data);
      console.log(`✅ Submission broadcasted in room ${testID}:`, data.studentEmail);
    }
  });

  // Handle student joining (to instantly populate rosters)
  socket.on('student_joined', (data) => {
    const { testID } = data;
    if (testID) {
      io.to(testID).emit('student_joined', data);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ A user disconnected:', socket.id);
  });
});

// Start the server (using server.listen instead of app.listen)
server.listen(PORT, () => {
  console.log(`Server started on ${PORT} (with WebSocket support)`);
});
