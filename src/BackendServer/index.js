const express = require("express");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const multer = require("multer");
const fs = require("fs");

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

//EJS
app.use(expressLayouts);
app.set("view engine", "ejs");

// Middleware to expose flash messages from query params to EJS
app.use((req, res, next) => {
  res.locals.success = req.query.success || null;
  res.locals.error = req.query.error || null;
  res.locals.upload = upload; // Expose upload middleware to routes
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

// Set static folder
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "index.html"));
// });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server started on ${PORT}`);
});
