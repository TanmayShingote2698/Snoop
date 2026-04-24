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

/**
 * Helper to find test in memory or hydrate from database.
 * Prevents data loss after server restarts.
 */
const getOrHydrateTest = async (testID, userEmail = null) => {
    // 1. Check memory
    let test = tests.find(t => t.id === testID);
    if (test) return test;

    // 2. Check Database
    try {
        const dbResponse = await new Promise((resolve, reject) => {
            const options = {
                url: 'http://127.0.0.1:100/getTest',
                json: true,
                body: { 'test_id': testID }
            };
            request.post(options, (err, resp, body) => {
                if (err) resolve(null); // Resolve null on error to avoid breaking flow
                else resolve(body);
            });
        });

        if (dbResponse && dbResponse.test_details) {
            console.log(`[Hydration] Found test ${testID} in DB. Hydrating memory.`);
            const hydratedTest = dbResponse.test_details;
            
            // Fix: Sometimes test_details might be a string in DB
            const testObj = (typeof hydratedTest === 'string') ? JSON.parse(hydratedTest) : hydratedTest;
            
            // Ensure ID consistency
            if (!testObj.id) testObj.id = testID;
            
            tests.push(testObj);
            return testObj;
        }
    } catch (e) {
        console.error(`[Hydration] Error:`, e);
    }
    return null;
};


router.post("/submitQues", async (req, res) => {
    let testID = req.body.testID;
    
    // Use hydration helper instead of loop
    let test = await getOrHydrateTest(testID, req.session.user ? req.session.user.email : null);
    
    if (test) {
        console.log(`\n📝 submitQues: Test ${testID} found (memory/hydrated). Adding question.`);

            
            // RBAC Check
            if (test.created_by && test.created_by !== req.session.user.email) {
                console.log(`   ❌ RBAC Violation: User ${req.session.user.email} tried to add question to test ${testID}`);
                 if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                    return res.json({ success: false, message: "Permission denied." });
                 } else {
                    return res.redirect("/teacher/showAllTests"); // Or render error
                 }
            }

            if (req.body.op1 !== undefined && req.body.op1 !== '') {
                const questionObj = {
                    question: String(req.body.question || ''),
                    op1: String(req.body.op1 || ''),
                    op2: String(req.body.op2 || ''),
                    op3: String(req.body.op3 || ''),
                    op4: String(req.body.op4 || ''),
                    answer: String(req.body.answer || ''),
                    type: 'mcq',
                    ind: test.questions.length + 1
                };
                test.questions.push(questionObj);
                
                // PERSISTENCE FIX: Always sync with DB after adding a question
                const updateOptions = {
                    url: 'http://127.0.0.1:100/createTest',
                    json: true,
                    body: { 'test_id': testID, 'test_details': test }
                };
                request.post(updateOptions);

                if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                    return res.json({ success: true, questions: test.questions });
                } else {
                    return res.render("createTest2", {
                        testIDfromNode: testID,
                        questions: test.questions,
                        hideHome: true,
                        success: "Question added successfully!"
                    });
                }
            }
    } else {
        console.log(`   ❌ submission failed: Test ${testID} not found.`);
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.json({ success: false, message: "Test session not found. Please restart the creation process." });
        } else {
            res.redirect("/teacher/home");
        }
    }
});

// Submit multiple questions at once (Batch)
router.post("/submitQuestionsBatch", checkAuthenticated, async (req, res) => {
    const { testID, questions: newQuestions } = req.body;
    
    console.log(`\n📦 submitQuestionsBatch called for Test ID: ${testID}`);
    
    if (!newQuestions || !Array.isArray(newQuestions)) {
        return res.status(400).json({ success: false, message: "Invalid questions array provided." });
    }

    // Use hydration helper
    let test = await getOrHydrateTest(testID, req.session.user.email);
    
    if (!test) {
        return res.status(404).json({ success: false, message: "Test session not found." });
    }

    // RBAC Check
    if (test.created_by && test.created_by !== req.session.user.email) {
        return res.status(403).json({ success: false, message: "Permission denied." });
    }

    console.log(`   Before batch add: ${test.questions.length} questions`);
    
    // Add questions to the test
    newQuestions.forEach(q => {
        const questionObj = {
            question: safeString(q.question),
            type: q.type || 'mcq',
            ind: test.questions.length + 1
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

        test.questions.push(questionObj);
    });

    // SYNC WITH DB
    const updateOptions = {
        url: 'http://127.0.0.1:100/createTest',
        json: true,
        body: { 'test_id': testID, 'test_details': test }
    };
    request.post(updateOptions);

    console.log(`   ✅ Batch add complete: ${test.questions.length} total questions`);
    
    res.json({
        success: true,
        message: `Successfully added ${newQuestions.length} questions.`,
        totalQuestions: test.questions.length
    });
});


// Delete a question from test
router.post("/deleteQuestion", async (req, res) => {
    const { testID, questionIndex } = req.body;
    console.log(`\n🗑️ deleteQuestion called - TestID: "${testID}", Index: ${questionIndex}`);
    
    let test = await getOrHydrateTest(testID, req.session.user.email);
    
    if (!test) {
        return res.json({ success: false, message: "Test not found." });
    }

    // RBAC Check
    if (test.created_by && test.created_by !== req.session.user.email) {
         return res.json({ success: false, message: "Permission denied." });
    }

    let questionDeleted = false;
    if (questionIndex >= 0 && questionIndex < test.questions.length) {
        test.questions.splice(questionIndex, 1);
        
        // SYNC WITH DB
        const updateOptions = {
            url: 'http://127.0.0.1:100/createTest',
            json: true,
            body: { 'test_id': testID, 'test_details': test }
        };
        request.post(updateOptions);
        
        questionDeleted = true;
    }

    res.json({
        success: questionDeleted,
        message: questionDeleted ? 'Question deleted successfully' : 'Failed to delete question'
    });
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

router.post("/takeTestID", async (req, res) => {
    let testID = req.body.testID;
    console.log(`\n🔍 takeTestID called for Test: ${testID}`);

    // Hydrate or find test
    let test = await getOrHydrateTest(testID, req.session.user.email);

    if (!test) {
        console.log(`   🆕 Test ${testID} is new. Initializing structure.`);
        test = {
            id: testID,
            questions: [],
            created_by: req.session.user.email
        };
        tests.push(test);
    } else {
        console.log(`   ✅ Test ${testID} already exists. Updating configuration.`);
        // Update ownership if missing for old tests
        if (!test.created_by) test.created_by = req.session.user.email;
        
        // RBAC: Verify ownership 
        if (test.created_by !== req.session.user.email) {
             console.log(`   ❌ RBAC Violation: User ${req.session.user.email} tried to access test ${testID} owned by ${test.created_by}`);
             return res.redirect("/teacher/showAllTests?error=" + encodeURIComponent("You do not have permission to access this test."));
        }
    }

    // Apply configuration from body
    test.testDuration = parseInt(req.body.testDuration) || test.testDuration || 0;
    test.warningThreshold = parseInt(req.body.warningThreshold) || test.warningThreshold || 0;
    test.startTime = req.body.startTime || test.startTime || '';
    test.endTime = req.body.endTime || test.endTime || '';
    test.accessCode = req.body.accessCode || test.accessCode || '';


    res.render("createTest2", {
        testIDfromNode: testID,
        questions: test.questions,
        hideHome: true
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
            'admin_id': req.body.adminID,
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
router.all("/showTestAfterCreation", async (req, res) => {
    let testID = req.body.testID || req.query.testID;
    console.log(`\n📋 showTestAfterCreation called for Test ID: "${testID}"`);
    
    // Hydrate first to avoid overwriting existing tests with empty shells
    let test = await getOrHydrateTest(testID, req.session.user ? req.session.user.email : null);

    if (!test) {
        console.log(`❌ Test not found in memory or DB! Creating fallback.`);
        test = {
            id: testID,
            questions: [],
            testDuration: 0,
            warningThreshold: 0,
            startTime: '',
            accessCode: '',
            created_by: req.session.user ? req.session.user.email : null
        };
        tests.push(test);
    }

    // Always sync with DB to be safe
    const options = {
        url: 'http://127.0.0.1:100/createTest',
        json: true,
        body: {
            'test_id': testID,
            'test_details': test,
        }
    };

    request.post(options, (err, resp, body) => {
        if (err) console.error('Error posting to test server:', err);
    });

    res.render("showTestAfterCreation", {
        test,
        hideHome: true
    });
});


// Edit Test - Re-open creation view with existing data
router.post("/editTest", checkAuthenticated, async (req, res) => {
    let testID = req.body.testID;
    let test = await getOrHydrateTest(testID, req.session.user.email);

    if (!test) {
        req.session.errorMessage = "Test not found in system.";
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
router.post("/saveGeneratedTest", checkAuthenticated, async (req, res) => {
    try {
        const testID = req.body.testID;
        const questions = JSON.parse(req.body.questions);
        const testDuration = req.body.testDuration;
        const accessCode = Math.random().toString(36).substring(7).toUpperCase();
         const startTime = new Date().getHours();
        const warningThreshold = 50;

        // Check if test already exists or needs hydration
        let testObj = await getOrHydrateTest(testID, req.session.user.email);
        
        if (!testObj) {
            testObj = { id: testID, questions: [] };
            tests.push(testObj);
        }

        // Update properties
        testObj.testDuration = testDuration;
        testObj.warningThreshold = warningThreshold;
        testObj.startTime = startTime;
        testObj.accessCode = accessCode;
        testObj.questions = questions; // Overwrite questions with generated ones
        testObj.generatedByAI = true;
        testObj.created_by = req.session.user.email;
        testObj.generatedAt = new Date().toISOString();


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
    
    // Find test details for the email template (Using hydration)
    const test = await getOrHydrateTest(testID, req.session.user.email) || {};

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
        
        let dbTests = [...tests]; // Fallback to memory tests
        
        try {
            // body is array of { test_details: {...} }
            // We map it to array of {...} for the view without overwriting memory
            if (body && Array.isArray(body)) {
                 dbTests = body.map(row => row.test_details);
                 console.log(`Fetched ${dbTests.length} tests from DB for display.`);
            }
        } catch (e) {
            console.log("Error parsing DB response:", e);
        }

        const userEmail = req.session.user.email;
        // RBAC: Filter tests to show only those created by the logged-in teacher (or legacy tests with no creator)
        let myTests = dbTests.filter(t => !t.created_by || t.created_by === userEmail); 
        // Sort tests by ID descending to show latest on top
        myTests.sort((a, b) => {
            const idA = parseInt(a.id) || 0;
            const idB = parseInt(b.id) || 0;
            return idB - idA;
        });
        
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
        
        // Fetch Test Details from DB to get Questions for the modal
        const testOptions = {
            url: 'http://127.0.0.1:100/getTest',
            json: true,
            body: {
                'test_id': testID
            }
        };
        
        request.post(testOptions, (errTest, respTest, bodyTest) => {
            let testQuestions = [];
            if (!errTest && bodyTest && bodyTest.test_details) {
                testQuestions = bodyTest.test_details.questions || [];
            } else if (!errTest && bodyTest) {
                // Handle different DB structure formats just in case
                testQuestions = bodyTest.questions || [];
            }
            
            res.render("teacherResultDetails", {
                testID: testID,
                results: resultsData,
                testQuestions: testQuestions,
                hideHome: true,
                currentPage: 'results'
            });
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

// Send Performance & Integrity Report to Student
router.post("/sendStudentReport", checkAuthenticated, async (req, res) => {
    const { 
        email, 
        testID, 
        mcqScore, 
        totalQuestions, 
        integrity, 
        cheatScore, 
        anomalies,
        teacherComment 
    } = req.body;

    console.log(`\n📧 Sending report to ${email} for Test ${testID}`);

    try {
        const result = await emailService.sendStudentReportEmail(email, {
            testID,
            studentName: email.split('@')[0],
            mcqScore,
            totalQuestions,
            integrity,
            cheatScore,
            anomalies,
            teacherComment
        });

        if (result.success) {
            res.json({ success: true, message: "Report sent successfully!" });
        } else {
            res.status(500).json({ success: false, message: "Failed to send email." });
        }
    } catch (error) {
        console.error("Report send error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Bulk Upload Questions
router.post("/uploadQuestions", checkAuthenticated, localUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            req.session.errorMessage = "No file uploaded.";
            return res.redirect("/teacher/showAllTests");
        }

        const testID = req.body.testID;
        const filePath = req.file.path;
        
        let test = await getOrHydrateTest(testID, req.session.user.email);
        
        if (!test) {
            // Cleanup and error
            fs.unlinkSync(filePath);
            req.session.errorMessage = "Test session lost. Please re-enter the Test ID.";
            return res.redirect("/teacher/showAllTests");
        }

        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // raw: false ensures we get formatted strings instead of cell objects/raw values
        const data = xlsx.utils.sheet_to_json(sheet, { raw: false });


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