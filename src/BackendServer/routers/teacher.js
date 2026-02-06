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
    let questionAdded = false;
    
    console.log(`\n📝 submitQues called for Test ID: ${testID}`);
    console.log(`   System state: ${tests.length} tests in memory`);
    console.log(`   Received data:`, {
        question: req.body.question ? req.body.question.substring(0, 50) : 'N/A',
        op1: req.body.op1 ? 'present' : 'N/A',
        answer: req.body.answer ? 'present' : 'N/A'
    });
    
    for (let i = 0; i < tests.length; i++) {
        console.log(`   Checking test[${i}]: id="${tests[i].id}" (type: ${typeof tests[i].id})`);
        if (tests[i].id === testID) {
            console.log(`   ✓✓✓ TEST FOUND at index ${i} - ADDING QUESTION ✓✓✓`);
            console.log(`   Before add: ${tests[i].questions.length} questions`);
            
            if (req.body.op1 !== undefined && req.body.op1 !== '') {
                const questionObj = {
                    question: req.body.question,
                    op1: req.body.op1,
                    op2: req.body.op2,
                    op3: req.body.op3,
                    op4: req.body.op4,
                    answer: req.body.answer,
                    type: 'mcq',
                    ind: tests[i].questions.length + 1
                };
                tests[i].questions.push(questionObj);
                console.log(`   ✅ Pushed MCQ to tests[${i}].questions`);
            } else {
                const questionObj = {
                    question: req.body.question,
                    answer: req.body.answer || '',
                    type: 'subjective',
                    ind: tests[i].questions.length + 1,
                };
                tests[i].questions.push(questionObj);
                console.log(`   ✅ Pushed Subjective to tests[${i}].questions`);
            }
            questions = tests[i].questions;
            questionAdded = true;
            console.log(`   After add: ${tests[i].questions.length} questions in tests[${i}]`);
            console.log(`   After add: ${questions.length} questions in local questions variable`);
            console.log(`   Memory address check: tests[${i}].questions === questions: ${tests[i].questions === questions}`);
            break;
        }
    }
    
    if (!questionAdded) {
        console.log(`   ❌ Test not found! Available test IDs: ${tests.map(t => `"${t.id}"`).join(', ')}`);
    }
    
    // Check if this is an AJAX request (has X-Requested-With header)
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    if (isAjax) {
        // AJAX request - return JSON (no page reload)
        console.log(`   📤 Sending AJAX response: success=${questionAdded}, totalQuestions=${questions.length}`);
        res.json({
            success: questionAdded,
            message: questionAdded ? 'Question saved successfully' : 'Failed to save question',
            totalQuestions: questions.length
        });
    } else {
        // Form submission - render page
        console.log(`   📄 Rendering form response with ${questions.length} questions`);
        res.render("createTest2", {
            testIDfromNode: testID,
            questions: questions,
            hideHome: true
        });
    }
});

// Delete a question from test
router.post("/deleteQuestion", (req, res) => {
    const { testID, questionIndex } = req.body;
    
    console.log(`\n🗑️ deleteQuestion called - TestID: "${testID}", Index: ${questionIndex}`);
    
    let questionDeleted = false;
    
    for (let i = 0; i < tests.length; i++) {
        if (tests[i].id === testID) {
            console.log(`   Test found at index ${i}`);
            console.log(`   Before delete: ${tests[i].questions.length} questions`);
            
            if (questionIndex >= 0 && questionIndex < tests[i].questions.length) {
                const deletedQuestion = tests[i].questions[questionIndex];
                tests[i].questions.splice(questionIndex, 1);
                console.log(`   ✅ Deleted Q${questionIndex + 1}: "${deletedQuestion.question.substring(0, 50)}..."`);
                console.log(`   After delete: ${tests[i].questions.length} questions\n`);
                questionDeleted = true;
            } else {
                console.log(`   ❌ Invalid question index: ${questionIndex}\n`);
            }
            break;
        }
    }
    
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    if (isAjax) {
        res.json({
            success: questionDeleted,
            message: questionDeleted ? 'Question deleted successfully' : 'Failed to delete question'
        });
    }
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
    console.log(`\n🏗️ takeTestID called - Creating/Updating test with ID: "${testID}" (type: ${typeof testID})`);
    console.log(`   Tests before: ${tests.length} existing tests`);
    
    let existingTestIndex = tests.findIndex(t => t.id === testID);
    console.log(`   Search result: existingTestIndex = ${existingTestIndex}`);

    if (existingTestIndex === -1) {
        console.log(`   → Creating NEW test`);
        let test = {};
        test.id = testID;
        test.testDuration = req.body.testDuration;
        test.warningThreshold = req.body.warningThreshold;
        test.startTime = req.body.startTime;
        test.accessCode = req.body.accessCode; // Store Access Code
        test.questions = [];
        tests.push(test);
        console.log(`   ✅ New test pushed to tests array at index ${tests.length - 1}`);
        console.log(`   ✅ Test structure: {id: "${test.id}", questions: [], ...}`);
    } else {
        // Update existing test details if re-entering
        console.log(`   → Updating EXISTING test at index ${existingTestIndex}`);
        tests[existingTestIndex].testDuration = req.body.testDuration;
        tests[existingTestIndex].warningThreshold = req.body.warningThreshold;
        tests[existingTestIndex].startTime = req.body.startTime;
        tests[existingTestIndex].accessCode = req.body.accessCode; // Update Access Code
        console.log(`   ✅ Existing test updated`);
    }

    console.log(`   Tests after: ${tests.length} total tests\n`);

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
        
        req.session.successMessage = "Welcome back, Faculty!";
        
        // express-session will auto-save the session
        res.redirect("/teacher/home");
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
        req.session.successMessage = "Account created successfully! You can now log in.";
        // express-session will auto-save the session
        res.redirect("/teacher/login");
    });

});

router.get("/showTeachers", (req, res) => {
    res.json(teacherCred);
});

// Show test after creation
router.post("/showTestAfterCreation", (req, res) => {
    let testID = req.body.testID;
    console.log(`\n📋 showTestAfterCreation called for Test ID: "${testID}" (type: ${typeof testID})`);
    console.log(`📊 Total tests in system at this moment: ${tests.length}`);
    console.log(`🔍 Full system state:`);
    tests.forEach((t, idx) => {
        console.log(`   tests[${idx}]: id="${t.id}" | questions: ${t.questions.length}`);
    });
    
    let test = null;
    let foundAtIndex = -1;
    for (let i = 0; i < tests.length; i++) {
        console.log(`  Comparing: tests[${i}].id="${tests[i].id}" === "${testID}" ? ${tests[i].id === testID}`);
        if (tests[i].id === testID) {
            foundAtIndex = i;
            test = tests[i];
            break;
        }
    }

    if (!test) {
        console.log(`❌ Test not found! Creating fallback empty test object.`);
        test = {
            id: testID,
            questions: [],
            testDuration: 0,
            warningThreshold: 0,
            startTime: '',
            accessCode: ''
        };
    } else {
        console.log(`✅✅ Test FOUND at index ${foundAtIndex}!`);
        console.log(`✅ Test has ${test.questions.length} questions`);
        if (test.questions.length > 0) {
            test.questions.forEach((q, idx) => {
                console.log(`   Q${idx + 1}: ${q.question.substring(0, 50)}...`);
            });
        }
    }

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
            console.log('Error posting to test server:', err);
        } else {
            console.log('Test server response:', body);
        }
    });

    console.log(`🎯 Rendering showTestAfterCreation with ${test.questions.length} questions`);
    console.log(`   Response object will contain:`, {
        id: test.id,
        questions_count: test.questions.length,
        testDuration: test.testDuration,
        warningThreshold: test.warningThreshold,
        startTime: test.startTime,
        accessCode: test.accessCode
    });
    console.log(`\n`);
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
        req.session.errorMessage = "Test not found.";
        return res.redirect("/teacher/showAllTests");
    }

    res.render("createTest2", {
        testIDfromNode: testID,
        questions: test.questions || [],
        hideHome: true
    });
});

// Delete Test
router.post("/deleteTest", checkAuthenticated, (req, res) => {
    let testID = req.body.testID;
    
    console.log("Attempting to delete test:", testID);
    
    // Call TestServer to delete from database
    const deleteOptions = {
        url: 'http://127.0.0.1:100/deleteTest',
        json: true,
        body: {
            'test_id': testID
        }
    };

    request.post(deleteOptions, (deleteErr, deleteResp, deleteBody) => {
        if (deleteErr) {
            console.error("Error deleting from database:", deleteErr);
            req.session.errorMessage = "Failed to delete test from database.";
            return res.redirect("/teacher/showAllTests");
        }
        
        console.log("Delete response:", deleteBody);
        
        // Now fetch fresh list from database
        const getAllOptions = {
            url: 'http://127.0.0.1:100/getAllTest',
            json: true
        };

        request.post(getAllOptions, (err, resp, body) => {
            if (err) {
                console.log("Error fetching updated tests:", err);
                // Still show success message even if sync fails
                req.session.successMessage = "Test deleted successfully!";
                return res.redirect("/teacher/showAllTests");
            }
            
            try {
                // body is array of { test_details: {...} }
                if (body && Array.isArray(body)) {
                    tests.length = 0;
                    body.forEach(row => tests.push(row.test_details));
                    console.log(`Synced ${tests.length} tests after deletion.`);
                }
            } catch (e) {
                console.log("Error parsing DB response:", e);
            }

            // Set success message and redirect - express-session will auto-save
            req.session.successMessage = "Test deleted successfully!";
            res.redirect("/teacher/showAllTests");
        });
    });
});

// AI Test Generation Routes
const AITestGenerator = require('../services/aiTestGenerator');
const aiGenerator = new AITestGenerator();

// Generate Questions via AI
router.post("/generateQuestionsAI", checkAuthenticated, async (req, res) => {
    const {
        testID,
        subject,
        topic,
        numberOfQuestions,
        difficultyLevel,
        questionTypes,
        duration,
        additionalInstructions
    } = req.body;

    console.log('\n📚 AI Generation Request');
    console.log(`  Test ID: ${testID}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Topic: ${topic}`);
    console.log(`  Questions: ${numberOfQuestions}`);
    console.log(`  Difficulty: ${difficultyLevel}`);

    try {
        const result = await aiGenerator.generateQuestions({
            subject,
            topic,
            numberOfQuestions: parseInt(numberOfQuestions),
            difficultyLevel,
            questionTypes,
            duration,
            additionalInstructions
        });

        if (result.success) {
            console.log(`  ✅ Generated ${result.questions.length} questions using ${result.service}`);
            res.json({
                success: true,
                questions: result.questions,
                service: result.service,
                message: `Successfully generated ${result.questions.length} questions`
            });
        } else {
            console.error(`  ❌ Error: ${result.error}`);
            res.json({
                success: false,
                error: result.error,
                questions: []
            });
        }
    } catch (error) {
        console.error("❌ AI Generation Error:", error.message);
        res.json({
            success: false,
            error: error.message,
            questions: []
        });
    }
});

// Save Generated Test
router.post("/saveGeneratedTest", checkAuthenticated, (req, res) => {
    try {
        const testID = req.body.testID;
        const questions = JSON.parse(req.body.questions);
        const testDuration = req.body.testDuration;
        const accessCode = Math.random().toString(36).substring(7).toUpperCase();
        const startTime = new Date().getHours();
        const warningThreshold = 50;

        // Create test object
        const testObj = {
            id: testID,
            testDuration: testDuration,
            warningThreshold: warningThreshold,
            startTime: startTime,
            accessCode: accessCode,
            questions: questions,
            generatedByAI: true,
            generatedAt: new Date().toISOString()
        };

        // Check if test already exists
        let existingTestIndex = tests.findIndex(t => t.id === testID);
        
        if (existingTestIndex === -1) {
            tests.push(testObj);
        } else {
            tests[existingTestIndex] = testObj;
        }

        // Save to database
        const options = {
            url: 'http://127.0.0.1:100/createTest',
            json: true,
            body: {
                'test_id': testID,
                'test_details': testObj
            }
        };

        request.post(options, (err, resp, body) => {
            if (err) {
                console.log("Error saving to DB:", err);
            }
            req.session.successMessage = "Test created successfully with AI-generated questions!";
            res.redirect(`/teacher/showTestAfterCreation?testID=${testID}`);
        });

    } catch (error) {
        console.error("Error saving generated test:", error);
        req.session.errorMessage = "Error saving test: " + error.message;
        res.redirect("/teacher/enterTestID");
    }
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
            req.session.errorMessage = "No file uploaded.";
            return res.redirect("/teacher/showAllTests");
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
            req.session.errorMessage = "Test not found.";
            return res.redirect("/teacher/showAllTests");
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
        req.session.errorMessage = "Error processing file.";
        res.redirect("/teacher/home");
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