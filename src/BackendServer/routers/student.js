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

/**
 * Robust utility to find a test across memory and database.
 * Handles string/number ID mismatches and auto-resyncs if not found.
 */
async function getTestById(testID) {
  const teacherModule = require("./teacher");
  const liveTests = teacherModule.tests;

  const findInMemory = (id) => {
    return liveTests.find(t => {
      const details = t.test_details || t;
      return String(details.id).trim() === String(id).trim();
    });
  };

  let test = findInMemory(testID);
  if (test) return test.test_details || test;

  console.log(`[getTestById] Test ${testID} not in memory. Syncing with DB...`);

  return new Promise((resolve) => {
    const options = {
      url: 'http://127.0.0.1:100/getAllTest',
      json: true
    };
    request.post(options, (err, resp, body) => {
      if (!err && body && Array.isArray(body)) {
        liveTests.length = 0;
        body.forEach(t => liveTests.push(t.test_details || t));
        const found = findInMemory(testID);
        resolve(found ? (found.test_details || found) : null);
      } else {
        console.error("[getTestById] DB Sync Failed:", err);
        resolve(null);
      }
    });
  });
}

router.get("/login", checkNotAuthenticated, (req, res) => {
  res.render("studentLogin", { returnTo: req.query.returnTo });
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

    // Handle Redirection
    if (req.body.returnTo) {
      return res.redirect(req.body.returnTo);
    }

    res.redirect("/student/home?email=" + encodeURIComponent(req.body.email) + "&success=" + encodeURIComponent(`Welcome back, ${userName}!`));

  });

});


// Direct Test Join Link
router.get("/join/:testID", (req, res) => {
  const testID = req.params.testID;

  if (!req.session.user) {
    return res.redirect(`/student/login?returnTo=${encodeURIComponent('/student/join/' + testID)}`);
  }

  res.render("joinTest", {
    testID,
    email: req.session.user.email,
    hideHome: true
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
  const email = req.session.user.email;
  const name = req.session.user.name; // retrieve name for dashboard

  // Step 1: Fetch student results
  const resultOptions = {
    url: 'http://127.0.0.1:200/getStudentResult',
    json: true,
    body: {
      "studentEmail": email,
    }
  };

  request.post(resultOptions, (err, resp, body) => {
    let results = [];
    if (!err && body && body.result) {
      results = body.result;
    } else if (err) {
      console.error("Error fetching student results:", err);
    }

    // Step 2: Fetch all tests to enrich history with dates/times
    const testOptions = {
      url: 'http://127.0.0.1:100/getAllTest',
      json: true
    };

    request.post(testOptions, (errTest, respTest, bodyTest) => {
      if (!errTest && bodyTest) {
        // Merge test dates into results
        results = results.map(r => {
          const matchDetails = bodyTest.find(t => String(t.test_details.id) === String(r.test_id));
          if (matchDetails) {
            const d = matchDetails.test_details;
            return {
              ...r,
              // Fix: map startTime to start_date and endTime to end_date
              // The frontend studentHome.ejs expects these specific keys
              start_date: d.startTime ? new Date(d.startTime).toLocaleString() : 'N/A',
              end_date: d.endTime ? new Date(d.endTime).toLocaleString() : 'N/A'
            };
          }
          return r;
        });
      }

      res.render("studentHome", {
        email,
        name,
        hideHome: true,
        results: results
      });
    });
  });
});

// Profile Routes
router.get("/profile", checkAuthenticated, (req, res) => {
  res.render("profile", {
    user: req.session.user,
    hideHome: true,
    currentPage: 'profile'
  });
});

router.post("/profile", checkAuthenticated, upload.single('photo'), (req, res) => {
  let photoUrl = req.file ? req.file.path : req.session.user.photo_url;
  let newName = req.body.name || req.session.user.name;

  const options = {
    url: 'http://127.0.0.1:300/updateProfile',
    json: true,
    body: {
      email: req.session.user.email,
      role: req.session.user.role,
      name: newName,
      photo_url: photoUrl
    }
  };

  request.post(options, (err, resp, body) => {
    if (!err && body && body.status) {
      req.session.user.name = newName;
      req.session.user.photo_url = photoUrl;
      res.redirect("/student/profile?success=" + encodeURIComponent("Profile updated successfully."));
    } else {
      console.error("Profile update error:", err || body);
      res.redirect("/student/profile?error=" + encodeURIComponent("Failed to update profile."));
    }
  });
});

// Security Routes
router.get("/security", checkAuthenticated, (req, res) => {
  res.render("security", {
    user: req.session.user,
    hideHome: true,
    currentPage: 'security'
  });
});

router.post("/security", checkAuthenticated, (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.redirect("/student/security?error=" + encodeURIComponent("New passwords do not match."));
  }

  const options = {
    url: 'http://127.0.0.1:300/changePassword',
    json: true,
    body: {
      email: req.session.user.email,
      role: req.session.user.role,
      currentPassword: currentPassword,
      newPassword: newPassword
    }
  };

  request.post(options, (err, resp, body) => {
    if (!err && body && body.status) {
      res.redirect("/student/security?success=" + encodeURIComponent("Password changed successfully."));
    } else {
      console.error("Password change error:", err || body);
      let errMsg = body && body.message ? body.message : "Failed to change password. Ensure current password is correct.";
      res.redirect("/student/security?error=" + encodeURIComponent(errMsg));
    }
  });
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
    email: req.body.email || req.session.user.email,
    hideHome: true,
    isolateTest: true
  });
});

// NEW ROUTE: System Check (Called from Instructions page)
router.post("/systemCheck", checkAuthenticated, async (req, res) => {
  const testID = req.body.testID;
  const test = await getTestById(testID);

  if (!test) {
    console.error(`[/systemCheck] Test ${testID} not found even after sync.`);
    return res.redirect("/student/home?error=" + encodeURIComponent("Session expired or Test not found."));
  }

  res.render("systemCheck", {
    test,
    email: req.body.email || req.session.user.email,
    hideHome: true,
    isolateTest: true
  });
});

// Start Exam Route (Called from System Check page)
router.post("/startExam", checkAuthenticated, async (req, res) => {
  const testID = req.body.testID;
  const test = await getTestById(testID);

  if (!test) {
    console.error(`[/startExam] Test ${testID} not found even after sync.`);
    return res.redirect("/student/home?error=" + encodeURIComponent("Session expired or Test not found."));
  }

  res.render("takeTestByStudent", {
    test,
    email: req.body.email || req.session.user.email,
    hideHome: true,
    isolateTest: true
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
    let q = test.questions[i];
    let q_id = q.ind.toString();
    let obj = {
      ind: q.ind,
      studentAnswer: req.body[q_id] || "",
      actualAnswer: q.op1 !== undefined ? q.answer : "This is a sbjective question"
    };
    qna.push(obj);
  }
  responseOfStudent.qna = qna;

  // Calculate Dynamic Integrity Score (from behavioral monitoring)
  const tabViolations = req.body.tabSwitchData ? JSON.parse(req.body.tabSwitchData) : [];
  const fsViolations = req.body.fullscreenData ? JSON.parse(req.body.fullscreenData) : [];
  const instantViolations = req.body.actionLogs ? JSON.parse(req.body.actionLogs) : [];

  let integrityScore = 100;

  // Deduct 10 points per tab switch
  integrityScore -= (tabViolations.length * 10);
  // Deduct 15 points per fullscreen exit (harsher penalty)
  integrityScore -= (fsViolations.length * 15);
  // Deduct 5 points per restricted key strike or mouse exit
  integrityScore -= (instantViolations.length * 5);

  if (integrityScore < 0) integrityScore = 0;

  // Parse AI Monitoring Data
  let aiCheatScore = 0;
  let anomalyData = [];
  let monitoringStats = {};

  try {
    aiCheatScore = parseFloat(req.body.cheatScore) || 0;
    anomalyData = req.body.anomalyData ? JSON.parse(req.body.anomalyData) : [];
    monitoringStats = req.body.monitoringStats ? JSON.parse(req.body.monitoringStats) : {};
  } catch (e) {
    console.error("Error parsing AI monitoring data:", e);
  }

  // Combine scores: Average of integrity (inverted) and AI cheat score
  // IntegrityScore: 100 = good, 0 = bad
  // CheatScore: 0 = good, 100 = bad
  // Convert integrity to cheat scale and average
  const invertedIntegrity = 100 - integrityScore;
  const combinedCheatScore = Math.min((invertedIntegrity * 0.4 + aiCheatScore * 0.6), 100);

  console.log(`[Submit Test] Student: ${responseOfStudent.studentEmail}, Test: ${testID}`);
  console.log(`  Integrity: ${integrityScore}, AI Cheat: ${aiCheatScore}, Combined: ${combinedCheatScore}`);

  const options = {
    url: 'http://127.0.0.1:200/' + 'scoreAndStore',
    json: true,
    body: {
      'response': {
        "testID": responseOfStudent.testID,
        "studentEmail": responseOfStudent.studentEmail,
        "qna": responseOfStudent.qna,
        "integrity": integrityScore,
        "cheatScore": aiCheatScore,
        "combinedCheatScore": combinedCheatScore,
        "anomalyData": anomalyData,
        "monitoringStats": monitoringStats,
        "tabSwitchData": tabViolations,
        "fullscreenData": fsViolations,
        "actionLogs": instantViolations
      }
    }
  };

  request.post(options, (err, resp, body) => {
    if (err) {
      console.error("Error storing test results:", err);
      return res.redirect("/student/home?email=" + encodeURIComponent(responseOfStudent.studentEmail) + "&error=" + encodeURIComponent("Error submitting test. Please try again."));
    }
    res.redirect("/student/home?email=" + encodeURIComponent(responseOfStudent.studentEmail) + "&success=" + encodeURIComponent("Examination submitted successfully! Check your results below."));
  });
});


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
