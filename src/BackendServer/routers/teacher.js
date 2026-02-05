const express = require("express");
const bcrypt = require('bcrypt');
const router = express.Router();
const publicDirPath = require("../public/toGetDir");
var request = require('request');
const SALT_ROUNDS = 12;

let teacherCred = [];
let tests = [];

router.post("/submitQues", (req, res) => {
    let testID = req.body.testID;
    let questions = [];
    for (let i = 0; i < tests.length; i++) {
        if (tests[i].id === testID) {
            if (req.body.op1 !== undefined) {
                tests[i].questions.push({
                    question: req.body.question,
                    op1: req.body.op1,
                    op2: req.body.op2,
                    op3: req.body.op3,
                    op4: req.body.op4,
                    answer: req.body.answer,
                    ind: tests[i].questions.length + 1
                });
            } else {
                tests[i].questions.push({
                    question: req.body.question,
                    ind: tests[i].questions.length + 1,
                });
            }
            questions = tests[i].questions;
        }
    }
    res.render("createTest2", {
        testIDfromNode: testID,
        questions: questions
    });
});

router.get("/enterTestID", (req, res) => {
    res.render("enterTestID");
});

router.post("/takeTestID", (req, res) => {
    let testID = req.body.testID;
    let existingTestIndex = tests.findIndex(t => t.id === testID);

    if (existingTestIndex === -1) {
        let test = {};
        test.id = testID;
        test.testDuration = req.body.testDuration;
        test.warningThreshold = req.body.warningThreshold;
        test.startTime = req.body.startTime;
        test.questions = [];
        tests.push(test);
    } else {
        // Update existing test details if re-entering
        tests[existingTestIndex].testDuration = req.body.testDuration;
        tests[existingTestIndex].warningThreshold = req.body.warningThreshold;
        tests[existingTestIndex].startTime = req.body.startTime;
    }

    res.render("createTest2", {
        testIDfromNode: testID,
        questions: (existingTestIndex !== -1) ? tests[existingTestIndex].questions : []
    });
});

router.get("/login", (req, res) => {
    res.render("teacherLogin");
    // res.sendFile(`${publicDirPath}/teacherLogin.html`);
});

router.get("/register", (req, res) => {
    res.render("teacherRegister");
    // res.sendFile(`${publicDirPath}/teacherRegister.html`);
});

router.post("/login", async (req, res) => {
    let found = -1;

    let inputEmail = req.body.email;
    let inputPassword = req.body.password;
    // SECURITY FIX: Password sent to server for bcrypt comparison (no more MD5)

    console.log(inputEmail);
    const options = {
        url: 'http://127.0.0.1:300/' + 'verifyAdmin',
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
            return res.redirect("/teacher/login?error=" + encodeURIComponent("Invalid Email or Password. Please try again."));
        }

        res.redirect("/teacher/home?success=" + encodeURIComponent("Welcome back, Administrator!"));
    });

});

let questionsOnNode;

router.get("/createTest", (req, res) => {
    res.render("createTest2", {
        questionsOnNode,
    });
    // res.sendFile(`${publicDirPath}/createTest.html`);
});

router.get("/test", (req, res) => {
    res.json(questionsOnNode);
    return;
});

router.post("/register", async (req, res) => {
    let found = false;
    let inputEmail = req.body.email;
    let inputName = req.body.name;
    let inputPassword = req.body.password;
    // SECURITY FIX: Password sent to server for bcrypt hashing (no more MD5)

    console.log(inputEmail);
    console.log(inputName);

    const options = {
        url: 'http://127.0.0.1:300/' + 'addAdmin',
        json: true,
        body: {
            'name': inputName,
            'email': inputEmail,
            'password': inputPassword
        }
    };

    request.post(options, (err, resp, body) => {
        if (err) {
            return console.log(err);
        }
        console.log(body);
        res.redirect("/teacher/login?success=" + encodeURIComponent("Account created successfully! You can now log in."));
    });

});

router.get("/showTeachers", (req, res) => {
    res.json(teacherCred);
});

// Show test after creation
router.post("/showTestAfterCreation", (req, res) => {
    let test = null;
    for (let i = 0; i < tests.length; i++) {
        if (tests[i].id === req.body.testID) {
            test = tests[i];
            break;
        }
    }

    let testID = req.body.testID;
    let testJSON = test;


    const options = {
        url: 'http://127.0.0.1:100/' + 'createTest',
        json: true,
        body: {
            'test_id': testID,
            'test_details': testJSON,
        }
    };

    request.post(options, (err, resp, body) => {
        if (err) {
            return console.log(err);
        }
        console.log(body);
    });

    // console.log(test);
    res.render("showTestAfterCreation", {
        test,
    });

});




// SHow All Tests
router.get("/showAllTests", (req, res) => {
    res.render("showAllTests", {
        tests,
    });
});

// Teacher Home Page
router.get("/home", (req, res) => {
    res.render("teacherHome");
});

module.exports = {
    router,
    tests
};