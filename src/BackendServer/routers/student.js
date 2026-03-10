const express = require("express");
var request = require('request');
const router = express.Router();
const bcrypt = require('bcrypt');
const { checkAuthenticated, checkNotAuthenticated } = require('../middleware/auth');
const multer = require("multer");
const path = require("path");
const SALT_ROUNDS = 12;

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require("dotenv").config();

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'snoop_students',
        allowed_formats: ['jpg', 'png', 'jpeg'],
    },
});

const upload = multer({ storage: storage });

const publicDirPath = require("../public/toGetDir");
let tests = require("./teacher").tests;

let studentCred = [];

// resultArr contains objects of responses of students
// in format:
// {
//    testID,
//    student email,
//    [question index(ind), response answer, answer of that index question]
// }
let resultArr = [];

router.get("/login", checkNotAuthenticated, (req, res) => {
  res.render("studentLogin");
  // res.sendFile(`${publicDirPath}/studentLogin.html`);
});

router.get("/register", checkNotAuthenticated, (req, res) => {
  res.render("studentRegister");
  // res.sendFile(`${publicDirPath}/studentRegister.html`);
});

router.post("/login", async (req, res) => {
  let found = -1;

  let inputEmail = req.body.email.toLowerCase();
  let inputPassword = req.body.password;
  // SECURITY FIX: Password sent to server for bcrypt comparison (no more MD5)

  console.log(inputEmail);
  const options = {
    url: 'http://127.0.0.1:300/' + 'verifyStudent',
    json: true,
    body: {
      'email': inputEmail,
      'password': inputPassword
    }
  };

  request.post(options, (err, resp, body) => {
    if (err) {
      return console.log(err);
    }
    console.log(body);
    if (body['verify'] == 'Success') {
      found = 1;
    }

    if (found === -1) {
      return res.redirect("/student/login?error=" + encodeURIComponent("Invalid Email or Password. Please try again."));
    }

    // Set Session
    const userName = body['name'] || inputEmail.split('@')[0];
    const userPhoto = body['photo_url'] || '/public/default-avatar.png'; // Fallback if null
    
    req.session.user = {
      role: 'student',
      email: inputEmail,
      name: userName,
      photo_url: userPhoto
    };

    res.redirect("/student/home?email=" + encodeURIComponent(req.body.email) + "&success=" + encodeURIComponent(`Welcome back, ${userName}!`));

  });

});


router.get("/tp", (req, res) => {
  res.render("tp");
});

router.post("/register", upload.single('photo'), async (req, res) => {
  let found = false;

  let inputEmail = req.body.email.toLowerCase();
  let inputName = req.body.name;
  let inputPassword = req.body.password;
  // SECURITY FIX: Password sent to server for bcrypt hashing (no more MD5)

  // Use Cloudinary URL or default placeholder
  let photoUrl = req.file ? req.file.path : "/public/default-avatar.png";

  console.log(inputEmail);
  console.log(inputName);

  const options = {
    url: 'http://127.0.0.1:300/' + 'addStudent',
    json: true,
    body: {
      'name': inputName,
      'email': inputEmail,
      'password': inputPassword,
      'photo_url': photoUrl
    }
  };

  request.post(options, (err, resp, body) => {
    if (err) {
      console.log(err);
      return res.redirect("/student/register?error=" + encodeURIComponent("Connection error. Please try again."));
    }
    console.log(body);
    res.redirect("/student/login?success=" + encodeURIComponent("Registration successful! Welcome to the Snoop family."));
  });

});


router.get("/showStudents", (req, res) => {
  res.json(studentCred);
});

// Student Home
router.get("/home", checkAuthenticated, (req, res) => {
  // Use session email if query param is missing (security hardening)
  const email = req.session.user.email;
  res.render("studentHome", { email, hideHome: true });
});

// Show all tests to student
router.post("/showAllTests", checkAuthenticated, (req, res) => {
  const options = {
    url: 'http://127.0.0.1:100/' + 'getAllTest'
  };

  request.post(options, (err, resp, body) => {
    if (err) {
      return console.log(err);
    }
    console.log("Database Data Retrived:")
    body = JSON.parse(body);
    console.log(body);
    console.log(body.length);



    // Fix: Update existing array in-place instead of reassignment
    tests.length = 0;
    body.forEach(t => tests.push(t));

    console.log("Tests Synced! Count:", tests.length);
    console.log("Shared Memory Updated.");

    res.render("showAllTestsToStudent", {
      tests,
      email: req.body.email,
      hideHome: true
    });
  });



});

// Give Test
router.post("/takeTest", checkAuthenticated, (req, res) => {
  // AI Proctoring: Start Anomaly Server EARLIER (during DB/Sync processing)
  const anomalyOptions = {
    url: 'http://127.0.0.1:5001/start',
    method: 'POST'
  };
  request.post(anomalyOptions, (err, resp, body) => {
    if (err) console.log("Anomaly Server Early Trigger Error:", err.message);
    else console.log("Anomaly Server Early Trigger Response:", body);
  });

  // Always fetch the live tests array from the teacher module source of truth
  const teacherModule = require("./teacher");
  const liveTests = teacherModule.tests;

  console.log(`\n--- TAKING TEST DEBUG ---`);
  console.log(`Requested ID: '${req.body.testID}'`);
  console.log(`Available Tests Count: ${liveTests.length}`);

  console.log("--- LIST OF AVAILABLE TESTS ---");
  liveTests.forEach((t, index) => {
    let tObj = t.test_details || t;
    console.log(`[${index}] ID: '${tObj.id}' | Code: '${tObj.accessCode || 'N/A'}'`);
  });
  console.log("-------------------------------");

  // Function to find test in a list
  const findTest = (list, id) => {
    for (let i = 0; i < list.length; i++) {
      let t = list[i].test_details || list[i];
      if (String(t.id).trim() === String(id).trim()) return t;
    }
    return null;
  };

  let testID = req.body.testID; // RESTORED LINE
  test = findTest(liveTests, testID);

  // If not found in memory, try fetching from DB (Resilience Update)
  if (!test) {
    console.log("Test not found in memory. Attempting to fetch from Database...");
    return new Promise((resolve, reject) => {
      const options = {
        url: 'http://127.0.0.1:100/getAllTest',
        json: true
      };
      request.post(options, (err, resp, body) => {
        if (err) {
          console.log("DB Fetch Error:", err);
          return res.redirect("/student/home?error=" + encodeURIComponent("Error connecting to database."));
        }

        if (body && Array.isArray(body)) {
          // Update Shared Memory
          liveTests.length = 0;
          body.forEach(t => liveTests.push(t.test_details || t));
          console.log(`Resynced ${liveTests.length} tests from DB.`);

          // Try finding again
          test = findTest(liveTests, testID);

          if (!test) {
            return res.redirect("/student/home?error=" + encodeURIComponent("Test ID not found (even after DB sync)."));
          }

          // Found after sync, proceed to verify access code
          if (test.accessCode) {
            const serverCode = String(test.accessCode).trim();
            const userCode = String(req.body.accessCode || '').trim();
            if (serverCode !== userCode) {
              return res.redirect("/student/home?error=" + encodeURIComponent("Invalid Access Code."));
            }
          }

          res.render("testInstructions", {
            test,
            email: req.body.email,
            hideHome: true
          });

        } else {
          return res.redirect("/student/home?error=" + encodeURIComponent("Database returned invalid data."));
        }
      });
    });
  } else {
    console.log(`MATCH FOUND IN MEMORY: ${test.id}`);
  }

  // console.log("Test is:")
  console.log(test)
  console.log(JSON.stringify(test));

  if (!test || !test.id) {
    return res.redirect("/student/home?error=" + encodeURIComponent("Test Search Failed: Test ID not found or invalid."));
  }

  // Access Code Verification
  if (test.accessCode) {
    const serverCode = String(test.accessCode).trim();
    const userCode = String(req.body.accessCode || '').trim();

    console.log(`Verifying Access Code: TestID=${test.id}, Server='${serverCode}', User='${userCode}'`);

    if (serverCode !== userCode) {
      return res.redirect("/student/home?error=" + encodeURIComponent("Invalid Access Code. Please try again."));
    }
  }

  // --- TIME WINDOW VALIDATION (START) ---
  if (test.startTime && test.endTime) {
      const now = new Date();
      const start = new Date(test.startTime);
      const end = new Date(test.endTime);

      if (now < start) {
          return res.redirect("/student/home?error=" + encodeURIComponent(`Test has not started yet. Starts at: ${start.toLocaleString()}`));
      }
      
      if (now > end) {
          return res.redirect("/student/home?error=" + encodeURIComponent("Test has expired. Access denied."));
      }
  }
  // --- TIME WINDOW VALIDATION (END) ---

    // res.render("testInstructions", {    <-- OLD
    //   test,
    //   email: req.body.email,
    //   hideHome: true
    // });
    
    // NEW FLOW: Render Instructions First
    res.render("testInstructions", {
      test,
      email: req.body.email,
      hideHome: true
    });
});

// NEW ROUTE: System Check (Called from Instructions page)
router.post("/systemCheck", checkAuthenticated, (req, res) => {
  const teacherModule = require("./teacher");
  const liveTests = teacherModule.tests;
  const testID = req.body.testID;

  // Verify Test Exists again (Security)
  let test = null;
  for (let i = 0; i < liveTests.length; i++) {
    let currentTest = liveTests[i].test_details || liveTests[i];
    if (currentTest.id === testID) {
      test = currentTest;
      break;
    }
  }

  if (!test) {
    return res.redirect("/student/home?error=" + encodeURIComponent("Session expired or Test not found."));
  }

  res.render("systemCheck", {
    test,
    email: req.body.email,
    hideHome: true
  });
});

// Start Exam Route (Called from Instructions page)
router.post("/startExam", checkAuthenticated, (req, res) => {
  const teacherModule = require("./teacher");
  const liveTests = teacherModule.tests;
  const testID = req.body.testID;

  let test = null;
  for (let i = 0; i < liveTests.length; i++) {
    let currentTest = liveTests[i].test_details || liveTests[i];
    if (currentTest.id === testID) {
      test = currentTest;
      break;
    }
  }

  if (!test) {
    return res.redirect("/student/home?error=" + encodeURIComponent("Session expired or Test not found."));
  }

  res.render("takeTestByStudent", {
    test,
    email: req.body.email,
    hideHome: true,
    aiProctoring: true // Pulse badge active
  });
});

// Handle reload (GET /startExam) -> Redirect to home (prevents "Cannot GET" error)
router.get("/startExam", (req, res) => {
    return res.redirect("/student/home?error=" + encodeURIComponent("Test session terminated due to page reload."));
});

// Route for accepting test responses from students
router.post('/submitTest', (req, res) => {
  let testID = req.body.testID;
  let test = null;
  for (let i = 0; i < tests.length; i++) {
    let currentTest = tests[i].test_details || tests[i];
    if (currentTest.id === testID) {
      test = currentTest;
      break;
    }
  }

  if (!test) {
    return res.redirect("/student/home?error=" + encodeURIComponent("Test not found. Session might have expired."));
  }

  let responseOfStudent = {};
  responseOfStudent.testID = testID;
  responseOfStudent.studentEmail = req.body.email;
  let qna = [];
  for (let i = 0; i < test.questions.length; i++) {
    let obj = {};
    let pos = (i + 1).toString();
    obj.ind = i + 1;
    obj.studentAnswer = req.body[pos];
    for (let j = 0; j < test.questions.length; j++) {
      if (i + 1 === test.questions[j].ind) {
        if (test.questions[j].op1 !== undefined) {
          obj.actualAnswer = test.questions[j].answer;
        }
        else {
          obj.actualAnswer = "This is a sbjective question";
        }
      }
    }
    qna.push(obj);
  }
  responseOfStudent.qna = qna;

  // AI Proctoring: Stop Anomaly Server and get score
  const anomalyStopOptions = {
    url: 'http://127.0.0.1:5001/stop',
    method: 'POST',
    json: true
  };

  request.post(anomalyStopOptions, (anomalyErr, anomalyResp, anomalyBody) => {
    let integrityScore = 100; // Default
    if (!anomalyErr && anomalyBody && anomalyBody.status === 'success') {
      integrityScore = anomalyBody.score;
      console.log("Final Integrity Score from AI:", integrityScore);
    } else {
      console.log("Anomaly Server Stop Error or invalid response:", anomalyErr || anomalyBody);
    }

    const options = {
      url: 'http://127.0.0.1:200/' + 'scoreAndStore',
      json: true,
      body: {
        'response': {
          "testID": responseOfStudent.testID,
          "studentEmail": responseOfStudent.studentEmail,
          "qna": responseOfStudent.qna,
          "integrity": integrityScore, // Pass real score
          "tabSwitchData": req.body.tabSwitchData ? JSON.parse(req.body.tabSwitchData) : [] // Parse hidden input
        }
      }
    };

    request.post(options, (err, resp, body) => {
      if (err) {
        return console.log(err);
      }
      res.redirect("/student/home?email=" + encodeURIComponent(responseOfStudent.studentEmail) + "&success=" + encodeURIComponent("Examination submitted successfully! Check your results below."));
    });
  });

})

router.get('/GetResultByEmail', (req, res) => {
  const email = req.query.email || "";
  res.render('getResultOfStudent', { email, hideHome: true });
})

router.post('/GetResultByEmail', (req, res) => {

  console.log("email Q:");
  console.log(req.body.email)
  const options = {
    url: 'http://127.0.0.1:200/' + 'getStudentResult',
    json: true,
    body: {
      "studentEmail": req.body.email,
    }
  };

  request.post(options, (err, resp, body) => {
    if (err) {
      return console.log(err);
    }
    console.log("Body!:")
    console.log(body);

    res.render('showResultUsingEmail', {
      results: body.result,
      hideHome: true
    })
  });


})

router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.log(err);
    res.redirect("/");
  });
});

module.exports = router;
