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
const emailService = require('../services/emailService');

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require("dotenv").config();

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const profileStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'snoop_teachers',
        allowed_formats: ['jpg', 'png', 'jpeg'],
    },
});

const localStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const profileUpload = multer({ storage: profileStorage });
const localUpload = multer({ storage: localStorage });

// Helper to safely extract string from xlsx cell (handles rich text objects)
const safeString = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'object') {
        if (val.h) return val.h.replace(/<[^>]*>/g, '').trim(); // Strip HTML
        if (val.v) return String(val.v).trim();
        if (Array.isArray(val)) return val.map(v => safeString(v)).join(' ').trim();
        return JSON.stringify(val);
    }
    return String(val).trim();
};
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
                    question: String(req.body.question || ''),
                    op1: String(req.body.op1 || ''),
                    op2: String(req.body.op2 || ''),
                    op3: String(req.body.op3 || ''),
                    op4: String(req.body.op4 || ''),
                    answer: String(req.body.answer || ''),
                    type: 'mcq',
                    ind: tests[i].questions.length + 1
                };
                tests[i].questions.push(questionObj);
                console.log(`   ✅ Pushed MCQ to tests[${i}].questions`);
            } else {
                const questionObj = {
                    question: String(req.body.question || ''),
                    answer: String(req.body.answer || ''),
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

// Submit multiple questions at once (Batch)
router.post("/submitQuestionsBatch", checkAuthenticated, (req, res) => {
    const { testID, questions: newQuestions } = req.body;
    
    console.log(`\n📦 submitQuestionsBatch called for Test ID: ${testID}`);
    console.log(`   Attempting to add ${newQuestions ? newQuestions.length : 0} questions`);
    
    if (!newQuestions || !Array.isArray(newQuestions)) {
        return res.status(400).json({ success: false, message: "Invalid questions array provided." });
    }

    let testIndex = tests.findIndex(t => t.id === testID);
    
    if (testIndex === -1) {
        console.log(`   ❌ Test ${testID} not found in memory.`);
        return res.status(404).json({ success: false, message: "Test not found." });
    }

    // RBAC Check
    if (tests[testIndex].created_by && tests[testIndex].created_by !== req.session.user.email) {
        console.log(`   ❌ RBAC Violation: User ${req.session.user.email} tried to add batch questions to test ${testID}`);
        return res.status(403).json({ success: false, message: "Permission denied." });
    }

    console.log(`   Before batch add: ${tests[testIndex].questions.length} questions`);
    
    // Add questions to the test
    newQuestions.forEach(q => {
        const questionObj = {
            question: safeString(q.question),
            type: q.type || 'mcq',
            ind: tests[testIndex].questions.length + 1
        };

        if (questionObj.type === 'mcq') {
            questionObj.op1 = safeString(q.op1);
            questionObj.op2 = safeString(q.op2);
            questionObj.op3 = safeString(q.op3);
            questionObj.op4 = safeString(q.op4);
            questionObj.answer = safeString(q.answer);
        } else {
            questionObj.answer = safeString(q.answer);
        }

        tests[testIndex].questions.push(questionObj);
    });

    console.log(`   ✅ Batch add complete: ${tests[testIndex].questions.length} total questions`);
    
    res.json({
        success: true,
        message: `Successfully added ${newQuestions.length} questions.`,
        totalQuestions: tests[testIndex].questions.length
    });
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
        const userPhoto = body['photo_url'] || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userName) + '&background=random';

        req.session.user = {
            role: 'teacher',
            email: inputEmail,
            name: userName,
            photo_url: userPhoto
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
router.all("/showTestAfterCreation", (req, res) => {
    let testID = req.body.testID || req.query.testID;
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

// Profile Routes
router.get("/profile", checkAuthenticated, (req, res) => {
    res.render("profile", {
        user: req.session.user,
        hideHome: true,
        currentPage: 'profile'
    });
});

router.post("/profile", checkAuthenticated, profileUpload.single('photo'), (req, res) => {
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
            res.redirect("/teacher/profile?success=" + encodeURIComponent("Profile updated successfully."));
        } else {
            console.error("Profile update error:", err || body);
            res.redirect("/teacher/profile?error=" + encodeURIComponent("Failed to update profile."));
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
        return res.redirect("/teacher/security?error=" + encodeURIComponent("New passwords do not match."));
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
            res.redirect("/teacher/security?success=" + encodeURIComponent("Password changed successfully."));
        } else {
            console.error("Password change error:", err || body);
            let errMsg = body && body.message ? body.message : "Failed to change password. Ensure current password is correct.";
            res.redirect("/teacher/security?error=" + encodeURIComponent(errMsg));
        }
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


// Send Test Invitations (Supports Manual & Excel)
router.post("/sendInvites", checkAuthenticated, localUpload.single('inviteFile'), async (req, res) => {
    const { testID, accessCode, emails } = req.body;
    const teacherName = req.session.user.name || "Your Teacher";
    
    // Find test details for the email template
    const test = tests.find(t => t.id === testID) || {};
    const testInfo = {
        duration: test.testDuration,
        startTime: test.startTime,
        endTime: test.endTime
    };

    let invitees = [];

    // 1. Process Manual Emails
    if (emails) {
        const manualEmails = emails.split(',').map(e => e.trim()).filter(e => e !== "");
        manualEmails.forEach(email => invitees.push({ email, name: 'Student' }));
    }

    // 2. Process Excel File
    if (req.file) {
        try {
            const workbook = xlsx.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(worksheet);

            data.forEach(row => {
                const email = row.Email || row.email || row.EMAIL;
                const name = row.Name || row.name || row.NAME || 'Student';
                if (email) invitees.push({ email, name });
            });

            // Delete temporary file
            fs.unlinkSync(req.file.path);
        } catch (excelErr) {
            console.error("Excel Parsing Error:", excelErr);
            req.session.errorMessage = "Failed to parse Excel file.";
            return res.redirect(`/teacher/showTestAfterCreation?testID=${testID}`);
        }
    }

    if (invitees.length === 0) {
        req.session.errorMessage = "No recipients found. Please provide emails or upload an Excel file.";
        return res.redirect(`/teacher/showTestAfterCreation?testID=${testID}`);
    }

    const directLink = `http://localhost:5000/student/join/${testID}`;
    console.log(`\n📧 Sending ${invitees.length} invitations for Test: ${testID} by ${teacherName}`);

    let successCount = 0;
    let failCount = 0;

    for (const invitee of invitees) {
        try {
            await emailService.sendTestInvitation(invitee.email, testID, accessCode, directLink, teacherName, testInfo);
            successCount++;
        } catch (error) {
            console.error(`   ❌ Failed to send to ${invitee.email}:`, error.message);
            failCount++;
        }
    }

    if (failCount === 0) {
        req.session.successMessage = `Successfully sent ${successCount} invitations!`;
    } else {
        req.session.errorMessage = `Sent ${successCount} invitations, but ${failCount} failed. Check server logs.`;
    }

    res.redirect(`/teacher/showTestAfterCreation?testID=${testID}`);
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

        // RBAC: Filter tests to show only those created by the logged-in teacher (or legacy tests with no creator)
        const userEmail = req.session.user.email;
        let myTests = tests.filter(t => !t.created_by || t.created_by === userEmail); 
        
        // Apply status filter if provided (upcoming, ongoing, completed)
        const filter = req.query.filter;
        let pageTitle = 'All Examinations';
        
        if (filter) {
            const now = new Date();
            myTests = myTests.filter(t => {
                // Parse dates and verify they are valid
                let start = null;
                let end = null;
                
                if (t.startTime) {
                    const parsedStart = new Date(t.startTime);
                    if (!isNaN(parsedStart.getTime())) start = parsedStart;
                }
                
                if (t.endTime) {
                    const parsedEnd = new Date(t.endTime);
                    if (!isNaN(parsedEnd.getTime())) end = parsedEnd;
                }
                
                // If a test doesn't have a valid start AND end, we only show it if the ongoing filter is active
                if (!start || !end) {
                    return filter === 'ongoing';
                }
                
                if (filter === 'upcoming') {
                    return now < start;
                } else if (filter === 'ongoing') {
                    return now >= start && now <= end;
                } else if (filter === 'completed') {
                    return now > end;
                }
                return true;
            });
            
            if (filter === 'upcoming') pageTitle = 'Upcoming Examinations';
            else if (filter === 'ongoing') pageTitle = 'Ongoing Examinations';
            else if (filter === 'completed') pageTitle = 'Completed Examinations';
        }
        
        console.log(`\n🕵️ RBAC View: User ${userEmail} sees ${myTests.length} tests (filter: ${filter || 'none'})`);
        
        // Debug logs to see what dates are being compared
        if (myTests.length > 0) {
            console.log(`First test start: ${myTests[0].startTime}`);
            console.log(`First test end: ${myTests[0].endTime}`);
            console.log(`Current server time: ${new Date().toISOString()}`);
        }

        res.render("showAllTests", {
            tests: myTests,
            hideHome: true,
            pageTitle: pageTitle,
            activeFilter: filter || 'all',
            currentPage: (filter === 'completed') ? 'results' : 'view_tests'
        });
    });
});

// Show Admin Detailed Results
router.post("/resultDetails", checkAuthenticated, (req, res) => {
    let testID = req.body.testID;
    
    // Call ResultServer to get detailed results
    const options = {
        url: 'http://127.0.0.1:200/getTestResult',
        json: true,
        body: {
            'test_id': testID
        }
    };

    request.post(options, (err, resp, body) => {
        if (err) {
            console.error("Error fetching results:", err);
            req.session.errorMessage = "Failed to fetch results from server.";
            return res.redirect("/teacher/showAllTests?filter=completed");
        }
        
        // Parse and enrich the data with proctoring analytics
        let resultsData = [];
        if (body && body.result && Array.isArray(body.result)) {
            resultsData = body.result.map(r => {
                let tabSwitchCount = 0;
                let totalTimeExited = 0;
                let fullscreenExits = 0;
                
                try {
                    // ResultServer might return tab_switch_data as a JSON string or Array
                    const tabData = (typeof r.tab_switch_data === 'string') ? JSON.parse(r.tab_switch_data) : (r.tab_switch_data || []);
                    
                    // Calculate exact counts and duration from the real data schema
                    tabData.forEach(event => {
                        // The frontend sends `type` like 'TAB_SWITCH' or 'FULLSCREEN_EXIT'
                        const evtType = event.type || event.eventType || event.action;
                        
                        if (evtType && typeof evtType === 'string') {
                            const upperType = evtType.toUpperCase();
                            if (upperType === 'TAB_SWITCH' || upperType === 'TAB_HIDDEN' || upperType === 'TAB_SWITCHED') {
                                tabSwitchCount++;
                            }
                            if (upperType === 'FULLSCREEN_EXIT' || upperType === 'FULLSCREEN_EXITED') {
                                fullscreenExits++;
                            }
                        }
                        
                        // Use exact duration if provided, otherwise fallback estimate
                        if (event.durationSeconds) {
                            totalTimeExited += event.durationSeconds;
                        } else if (evtType) {
                            totalTimeExited += 5; // Fallback estimate
                        }
                    });
                    
                    // Round the total time to 1 decimal place for cleaner display
                    totalTimeExited = Math.round(totalTimeExited * 10) / 10;
                } catch(e) {
                    console.error("Error parsing tab data for student:", r.email, e);
                }
                
                return {
                    ...r,
                    tabSwitchCount,
                    fullscreenExits,
                    totalTimeExited
                };
            });
        }
        
        res.render("teacherResultDetails", {
            testID: testID,
            results: resultsData,
            hideHome: true,
            currentPage: 'results'
        });
    });
});

// Show Real-Time Live Monitor Dashboard
router.get("/liveMonitor/:testID", checkAuthenticated, (req, res) => {
    res.render("teacherLiveMonitor", {
        testID: req.params.testID,
        hideHome: true,
        currentPage: 'ongoing'
    });
});

// Bulk Upload Questions
router.post("/uploadQuestions", checkAuthenticated, localUpload.single('file'), (req, res) => {
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
        // raw: false ensures we get formatted strings instead of cell objects/raw values
        const data = xlsx.utils.sheet_to_json(sheet, { raw: false });

        let test = tests.find(t => t.id === testID);
        if (!test) {
            // Cleanup and error
            fs.unlinkSync(filePath);
            req.session.errorMessage = "Test not found.";
            return res.redirect("/teacher/showAllTests");
        }

        let addedCount = 0;
        data.forEach((row, index) => {
            // Use safeString to handle potential object values from rich text cells
            const qText = safeString(row.question);
            const qType = safeString(row.type).toLowerCase();

            if (!qText || !qType) return;

            let newQ = {
                question: qText,
                ind: (test.questions.length || 0) + 1
            };

            if (qType === 'mcq') {
                if(row.op1 && row.op2 && row.op3 && row.op4 && row.answer) {
                    newQ.op1 = safeString(row.op1);
                    newQ.op2 = safeString(row.op2);
                    newQ.op3 = safeString(row.op3);
                    newQ.op4 = safeString(row.op4);
                    newQ.answer = safeString(row.answer);
                    newQ.type = 'mcq';
                    test.questions.push(newQ);
                    addedCount++;
                }
            } else if (qType === 'subjective') {
                newQ.type = 'subjective';
                newQ.answer = safeString(row.answer);
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
                status = 'no-schedule';
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