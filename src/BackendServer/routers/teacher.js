const express = require("express");
const bcrypt = require('bcrypt');
const router = express.Router();
const publicDirPath = require("../public/toGetDir");
var request = require('request');
const { checkAuthenticated, checkNotAuthenticated } = require('../middleware/auth');
const xlsx = require('xlsx');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const upload = multer({ dest: 'uploads/' });
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
        questions: questions,
        hideHome: true
    });
});

router.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) console.log(err);
        res.redirect("/");
    });
});

router.get("/enterTestID", checkAuthenticated, (req, res) => {
    res.render("enterTestID", { hideHome: true });
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
        test.accessCode = req.body.accessCode; // Store Access Code
        test.questions = [];
        tests.push(test);
    } else {
        // Update existing test details if re-entering
        tests[existingTestIndex].testDuration = req.body.testDuration;
        tests[existingTestIndex].warningThreshold = req.body.warningThreshold;
        tests[existingTestIndex].startTime = req.body.startTime;
        tests[existingTestIndex].accessCode = req.body.accessCode; // Update Access Code
    }

    res.render("createTest2", {
        testIDfromNode: testID,
        questions: (existingTestIndex !== -1) ? tests[existingTestIndex].questions : []
    });
});

router.get("/login", checkNotAuthenticated, (req, res) => {
    res.render("teacherLogin");
    // res.sendFile(`${publicDirPath}/teacherLogin.html`);
});

router.get("/register", checkNotAuthenticated, (req, res) => {
    res.render("teacherRegister");
    // res.sendFile(`${publicDirPath}/teacherRegister.html`);
});

router.post("/login", async (req, res) => {
    let found = -1;

    let inputEmail = req.body.email.toLowerCase();
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

        // Set Session
        req.session.user = {
            role: 'teacher',
            email: inputEmail,
            name: body['name'] || 'Faculty' // Assuming auth server returns name, else default
        };

        res.redirect("/teacher/home?success=" + encodeURIComponent("Welcome back, Faculty!"));
    });

});

let questionsOnNode;

router.get("/createTest", checkAuthenticated, (req, res) => {
    res.render("createTest2", {
        questionsOnNode,
        hideHome: true
    });
    // res.sendFile(`${publicDirPath}/createTest.html`);
});

router.get("/test", (req, res) => {
    res.json(questionsOnNode);
    return;
});

router.post("/register", async (req, res) => {
    let found = false;
    let inputEmail = req.body.email.toLowerCase();
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
        hideHome: true
    });

});

// Edit Test - Re-open creation view with existing data
router.post("/editTest", checkAuthenticated, (req, res) => {
    let testID = req.body.testID;
    let test = tests.find(t => t.id === testID);

    if (!test) {
        return res.redirect("/teacher/showAllTests?error=" + encodeURIComponent("Test not found."));
    }

    res.render("createTest2", {
        testIDfromNode: testID,
        questions: test.questions || [],
        hideHome: true
    });
});




// Show All Tests - Fetched from DB for persistence
router.get("/showAllTests", checkAuthenticated, (req, res) => {
    const options = {
        url: 'http://127.0.0.1:100/getAllTest',
        json: true
    };

    request.post(options, (err, resp, body) => {
        if (err) {
            console.log("Error fetching tests:", err);
             // Fallback to local tests
            return res.render("showAllTests", {
                tests,
                hideHome: true,
                error: "Could not sync with database."
            });
        }
        
        try {
            // body is array of { test_details: {...} }
            // We map it to array of {...} for the view
            if (body && Array.isArray(body)) {
                 // Update array in-place to preserve reference for other modules
                 tests.length = 0;
                 body.forEach(row => tests.push(row.test_details));
                 console.log(`Synced ${tests.length} tests from DB.`);
            }
        } catch (e) {
            console.log("Error parsing DB response:", e);
        }

        res.render("showAllTests", {
            tests,
            hideHome: true
        });
    });
});

// Bulk Upload Questions
router.post("/uploadQuestions", checkAuthenticated, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.redirect("/teacher/showAllTests?error=" + encodeURIComponent("No file uploaded."));
        }

        const testID = req.body.testID;
        const filePath = req.file.path;
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        let test = tests.find(t => t.id === testID);
        if (!test) {
            // Cleanup and error
            fs.unlinkSync(filePath);
            return res.redirect("/teacher/showAllTests?error=" + encodeURIComponent("Test not found."));
        }

        let addedCount = 0;
        data.forEach((row, index) => {
            // Basic validation
            if (!row.question || !row.type) return;

            let type = row.type.toLowerCase();
            let newQ = {
                question: row.question,
                ind: (test.questions.length || 0) + 1
            };

            if (type === 'mcq') {
                if(row.op1 && row.op2 && row.op3 && row.op4 && row.answer) {
                    newQ.op1 = row.op1;
                    newQ.op2 = row.op2;
                    newQ.op3 = row.op3;
                    newQ.op4 = row.op4;
                    newQ.answer = row.answer;
                    test.questions.push(newQ);
                    addedCount++;
                }
            } else if (type === 'subjective') {
                test.questions.push(newQ);
                addedCount++;
            }
        });

        // Cleanup file
        fs.unlinkSync(filePath);

        res.render("createTest2", {
            testIDfromNode: testID,
            questions: test.questions,
            hideHome: true,
            success: `Successfully added ${addedCount} questions.`
        });

    } catch (err) {
        console.error(err);
        res.redirect("/teacher/home?error=" + encodeURIComponent("Error processing file."));
    }
});

// Teacher Home Page
router.get("/home", checkAuthenticated, (req, res) => {
    res.render("teacherHome", { hideHome: true });
});

module.exports = {
    router,
    tests
};