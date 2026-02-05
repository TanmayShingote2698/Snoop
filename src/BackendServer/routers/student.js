const express = require("express");
var request = require('request');
const router = express.Router();
const bcrypt = require('bcrypt');
const multer = require("multer");
const path = require("path");
const SALT_ROUNDS = 12;

// Multer Storage Configuration for student photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
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

router.get("/login", (req, res) => {
  res.render("studentLogin");
  // res.sendFile(`${publicDirPath}/studentLogin.html`);
});

router.get("/register", (req, res) => {
  res.render("studentRegister");
  // res.sendFile(`${publicDirPath}/studentRegister.html`);
});

router.post("/login", async (req, res) => {
  let found = -1;

  let inputEmail = req.body.email;
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

    res.redirect("/student/home?email=" + encodeURIComponent(req.body.email) + "&success=" + encodeURIComponent(`Welcome back, ${req.body.email.split('@')[0]}!`));

  });

});


router.get("/tp", (req, res) => {
  res.render("tp");
});

router.post("/register", upload.single('photo'), async (req, res) => {
  let found = false;

  let inputEmail = req.body.email;
  let inputName = req.body.name;
  let inputPassword = req.body.password;
  // SECURITY FIX: Password sent to server for bcrypt hashing (no more MD5)

  // Use uploaded file path or a default placeholder
  let photoUrl = req.file ? `/uploads/${req.file.filename}` : "/public/default-avatar.png";

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
router.get("/home", (req, res) => {
  const email = req.query.email || "";
  if (!email) {
    return res.redirect("/student/login?error=" + encodeURIComponent("Please log in to access the dashboard."));
  }
  res.render("studentHome", { email });
});

// Show all tests to student
router.post("/showAllTests", (req, res) => {
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

    for (let i = 0; i < body.length; i++) {

      console.log(body[i]['test_id']);
      console.log("--------------------------");
    }
    tests = body;
    console.log("Tests Before!:")
    console.log(tests)
    console.log(req.body)
    res.render("showAllTestsToStudent", {
      tests,
      email: req.body.email
    });
  });



});

// Give Test
router.post("/takeTest", (req, res) => {
  console.log("Avail Tests")
  console.log(tests)
  let testID = req.body.testID;
  let test = {};
  for (let i = 0; i < tests.length; i++) {
    if (tests[i].test_details.id === testID) {
      test = tests[i].test_details;
      break;
    }
  }
  // let test = tests[ind].test_details;

  // console.log("Test ID Requested:");
  // console.log(req.body.testID);
  // for (let i = 0; i < tests.length; i++) {
  //   if (parseInt(tests[i].id) === parseInt(req.body.testID)) {
  //     test = tests[i];
  //     break;
  //   }
  // }
  // console.log("All Tests:")
  // console.log(tests)
  // console.log("Test is:")
  console.log(test)
  console.log(JSON.stringify(test));
  res.render("takeTestByStudent", {
    test,
    email: req.body.email
  });

});

// Route for accepting test responses from students
router.post('/submitTest', (req, res) => {
  let testID = req.body.testID;
  let test = null;
  for (let i = 0; i < tests.length; i++) {
    if (tests[i].test_details.id === testID) {
      test = tests[i].test_details;
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

  const options = {
    url: 'http://127.0.0.1:200/' + 'scoreAndStore',
    json: true,
    body: {
      'response': {
        "testID": responseOfStudent.testID,
        "studentEmail": responseOfStudent.studentEmail,
        "qna": responseOfStudent.qna
      }
    }
  };

  request.post(options, (err, resp, body) => {
    if (err) {
      return console.log(err);
    }
    // Redirect back to home with success message and email persistence
    res.redirect("/student/home?email=" + encodeURIComponent(responseOfStudent.studentEmail) + "&success=" + encodeURIComponent("Examination submitted successfully! Check your results below."));
  });

})

router.get('/GetResultByEmail', (req, res) => {
  const email = req.query.email || "";
  res.render('getResultOfStudent', { email });
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
      results: body.result
    })
  });


})

module.exports = router;
