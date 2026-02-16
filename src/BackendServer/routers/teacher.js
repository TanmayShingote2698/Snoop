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
            
            // RBAC Check
            if (tests[i].created_by && tests[i].created_by !== req.session.user.email) {
                console.log(`   ❌ RBAC Violation: User ${req.session.user.email} tried to add question to test ${testID}`);
                 if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                    return res.json({ success: false, message: "Permission denied." });
                 } else {
                    return res.redirect("/teacher/showAllTests"); // Or render error
                 }
            }

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
            
            // RBAC Check
            if (tests[i].created_by && tests[i].created_by !== req.session.user.email) {
                 console.log(`   ❌ RBAC Violation: Delete Question denied.`);
                 if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                    return res.json({ success: false, message: "Permission denied." });
                 }
                 break; 
            }

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
    res.render("enterTestID", { 
        hideHome: true,
        currentPage: 'create_test'
    });
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
        test.endTime = req.body.endTime; // Capture End Time
        test.accessCode = req.body.accessCode; // Store Access Code
        test.created_by = req.session.user.email; // RBAC: Tag with creator email
        test.questions = [];
        tests.push(test);
        
        // SAVE TO DB IMMEDIATELY to persist ownership
        const options = {
            url: 'http://127.0.0.1:100/createTest',
            json: true,
            body: {
                'test_id': testID,
                'test_details': test
            }
        };
        request.post(options, (err, resp, body) => {
            if (err) console.log("Error saving new test to DB:", err);
            else console.log("New test saved to DB with owner:", test.created_by);
        });

        console.log(`   ✅ New test pushed to tests array at index ${tests.length - 1}`);
        console.log(`   ✅ Test structure: {id: "${test.id}", start: "${test.startTime}", end: "${test.endTime}", ...}`);
    } else {
        // RBAC: Verify ownership before update
        if (tests[existingTestIndex].created_by && tests[existingTestIndex].created_by !== req.session.user.email) {
             console.log(`   ❌ RBAC Violation: User ${req.session.user.email} tried to edit test ${testID} owned by ${tests[existingTestIndex].created_by}`);
             return res.redirect("/teacher/showAllTests?error=" + encodeURIComponent("You do not have permission to edit this test."));
        }

        // Update existing test details if re-entering
        console.log(`   → Updating EXISTING test at index ${existingTestIndex}`);
        tests[existingTestIndex].testDuration = req.body.testDuration;
        tests[existingTestIndex].warningThreshold = req.body.warningThreshold;
        tests[existingTestIndex].startTime = req.body.startTime;
        tests[existingTestIndex].endTime = req.body.endTime;
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
        const userName = body['name'] || 'Faculty';
        
        req.session.user = {
            role: 'teacher',
            email: inputEmail,
            name: userName,
            photo_url: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userName) + '&background=random' // Use UI Avatars for teachers
        };
        
        req.session.successMessage = `Welcome back, ${userName}!`;
        
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

    // RBAC Check
    if (test.created_by && test.created_by !== req.session.user.email) {
        req.session.errorMessage = "Permission denied: You cannot edit this test.";
        return res.redirect("/teacher/showAllTests");
    }

    // Time-based edit lock: Block editing for ongoing or completed tests
    const now = new Date();
    const start = test.startTime ? new Date(test.startTime) : null;
    const end = test.endTime ? new Date(test.endTime) : null;
    
    if (start && end) {
        if (now >= start && now <= end) {
            req.session.errorMessage = "This test is currently ongoing and cannot be edited.";
            return res.redirect("/teacher/showAllTests");
        }
        if (now > end) {
            req.session.errorMessage = "This test has been completed and cannot be edited.";
            return res.redirect("/teacher/showAllTests");
        }
    }

    // Render Edit Details View instead of Questions View directly
    res.render("editTestDetails", {
        test: test,
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

    const testIndex = tests.findIndex(t => t.id === testID);
    if (testIndex !== -1) {
        const test = tests[testIndex];
        // RBAC Check
        if (test.created_by && test.created_by !== req.session.user.email) {
             req.session.errorMessage = "Permission denied: You cannot delete this test.";
             return res.redirect("/teacher/showAllTests");
        }
    }

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
            created_by: req.session.user.email, // RBAC Tag
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

        // RBAC: Filter tests to show only those created by the logged-in teacher
        const userEmail = req.session.user.email;
        let myTests = tests.filter(t => t.created_by === userEmail); 
        
        // Apply status filter if provided (upcoming, ongoing, completed)
        const filter = req.query.filter;
        let pageTitle = 'All Examinations';
        
        if (filter) {
            const now = new Date();
            myTests = myTests.filter(t => {
                const start = t.startTime ? new Date(t.startTime) : null;
                const end = t.endTime ? new Date(t.endTime) : null;
                
                if (!start || !end) return filter === 'ongoing'; // No time = ongoing
                
                if (filter === 'upcoming') return now < start;
                if (filter === 'ongoing') return now >= start && now <= end;
                if (filter === 'completed') return now > end;
                return true;
            });
            
            if (filter === 'upcoming') pageTitle = 'Upcoming Examinations';
            else if (filter === 'ongoing') pageTitle = 'Ongoing Examinations';
            else if (filter === 'completed') pageTitle = 'Completed Examinations';
        }
        
        console.log(`\n🕵️ RBAC View: User ${userEmail} sees ${myTests.length} tests (filter: ${filter || 'none'})`);

        res.render("showAllTests", {
            tests: myTests,
            hideHome: true,
            pageTitle: pageTitle,
            activeFilter: filter || 'all'
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
    const userEmail = req.session.user.email;
    
    // Fetch tests from DB via TestServer API
    const options = {
        url: 'http://localhost:100/getAllTest',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        json: true
    };
    
    request(options, (err, response, body) => {
        let allTests = [];
        
        // 1. Add in-memory tests (created this session)
        const memoryTests = tests.filter(t => t.created_by === userEmail);
        memoryTests.forEach(t => {
            allTests.push({
                id: t.id,
                startTime: t.startTime || null,
                endTime: t.endTime || null,
                testDuration: t.testDuration || null,
                created_by: t.created_by
            });
        });
        
        // 2. Add DB tests (from TestServer)
        if (!err && body && Array.isArray(body)) {
            body.forEach(record => {
                const details = record.test_details || record;
                // Avoid duplicates (already in memory)
                const alreadyInMemory = allTests.some(t => t.id === (details.id || details.test_id));
                if (!alreadyInMemory) {
                    // Only show tests created by this teacher
                    if (!details.created_by || details.created_by === userEmail) {
                        allTests.push({
                            id: details.id || details.test_id || 'Unknown',
                            startTime: details.startTime || details.start_time || null,
                            endTime: details.endTime || details.end_time || null,
                            testDuration: details.testDuration || details.duration || null,
                            created_by: details.created_by || null
                        });
                    }
                }
            });
        } else {
            console.log("Could not fetch tests from DB:", err ? err.message : "No data");
        }
        
        // Calculate Stats & Build Recent Activity
        const now = new Date();
        let upcoming = 0;
        let ongoing = 0;
        let completed = 0;
        
        const recentTests = allTests.map((t) => {
            const start = t.startTime ? new Date(t.startTime) : null;
            const end = t.endTime ? new Date(t.endTime) : null;
            let status = 'unknown';
            let timeInfo = '';
            
            if (start && end) {
                if (now < start) {
                    upcoming++;
                    status = 'upcoming';
                    const diffMs = start - now;
                    const diffMins = Math.round(diffMs / 60000);
                    if (diffMins < 60) {
                        timeInfo = `in ${diffMins} min`;
                    } else if (diffMins < 1440) {
                        timeInfo = `in ${Math.round(diffMins / 60)} hr`;
                    } else {
                        timeInfo = `in ${Math.round(diffMins / 1440)} days`;
                    }
                } else if (now >= start && now <= end) {
                    ongoing++;
                    status = 'ongoing';
                    const diffMs = end - now;
                    const diffMins = Math.round(diffMs / 60000);
                    if (diffMins < 60) {
                        timeInfo = `${diffMins} min left`;
                    } else {
                        timeInfo = `${Math.round(diffMins / 60)} hr left`;
                    }
                } else if (now > end) {
                    completed++;
                    status = 'completed';
                    const diffMs = now - end;
                    const diffMins = Math.round(diffMs / 60000);
                    if (diffMins < 60) {
                        timeInfo = `${diffMins} min ago`;
                    } else if (diffMins < 1440) {
                        timeInfo = `${Math.round(diffMins / 60)} hr ago`;
                    } else {
                        timeInfo = `${Math.round(diffMins / 1440)} days ago`;
                    }
                }
            } else {
                ongoing++;
                status = 'ongoing';
                timeInfo = 'No time set';
            }
            
            return {
                id: t.id,
                status: status,
                timeInfo: timeInfo,
                startTime: start ? start.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A',
                duration: t.testDuration || 'N/A'
            };
        });

        // Sort by start time — earliest first
        recentTests.sort((a, b) => {
            const timeA = a.startTime === 'N/A' ? Infinity : new Date(a.startTime).getTime();
            const timeB = b.startTime === 'N/A' ? Infinity : new Date(b.startTime).getTime();
            return timeA - timeB;
        });

        res.render("teacherHome", { 
            hideHome: true,
            currentPage: 'dashboard',
            stats: {
                total: allTests.length,
                upcoming,
                ongoing,
                completed
            },
            recentTests: recentTests
        });
    });
});

module.exports = {
    router,
    tests
};