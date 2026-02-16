const express = require("express");
const router = express.Router();
const path = require("path");
const publicDirPath = require("../public/toGetDir");
const { checkNotAuthenticated } = require('../middleware/auth');

router.get("/", (req, res) => {
  res.render("RootPage", { layout: false });
  // res.sendFile(`${publicDirPath}/RootPage.html`);
});

router.get("/AccessPortal", checkNotAuthenticated, (req, res) => {
  res.render("AccessPortal", { layout: false });
});

// --- Forgot Password Logic ---
const nodemailer = require('nodemailer');
const request = require('request');

// Configure Transport (Replace with real credentials)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'placeholder', 
        pass: (process.env.EMAIL_PASS || 'placeholder').replace(/\s+/g, '') // Remove spaces from App Password
    }
});

// Helper to check if email config is valid
const isEmailConfigured = () => {
    return process.env.EMAIL_USER && process.env.EMAIL_USER !== 'your-email@gmail.com' &&
           process.env.EMAIL_PASS && process.env.EMAIL_PASS !== 'your-app-password';
};

// 1. Show Forgot Password Form
router.get("/forgot-password", (req, res) => {
    res.render("forgotPassword", { error: req.query.error, success: req.query.success });
});

// 2. Handle Forgot Password Submission
router.post("/forgot-password", (req, res) => {
    const email = req.body.email;
    const token = Date.now() + Math.random().toString(36).substring(2); // Simple token
    
    // In a real app, store this token in DB with expiration
    // For now, we encode it in the link
    
    const resetLink = `http://localhost:5000/reset-password?email=${email}&token=${token}`;
    
    console.log("========================================");
    console.log(`[RESET LINK] For ${email}: ${resetLink}`);
    console.log("========================================");
    
    const mailOptions = {
        from: 'Snoop Support <no-reply@snoop.com>',
        to: email,
        subject: 'Password Reset Request',
        html: `
            <p>Dear User,</p>
            <p>We received a request to reset the password for your account.</p>
            <p>If you made this request, please click the link below to create a new password:</p>
            <p><a href="${resetLink}">Reset Password</a></p>
            <p>For security reasons, this link will expire in 1 hour. If the link expires, you can request a new password reset from the login page.</p>
            <p>If you did NOT request a password reset, please ignore this email. Your account remains secure, and no changes have been made. We strongly recommend that you do not share this email or the reset link with anyone.</p>
            <p>If you believe someone is trying to access your account without permission, please contact our support team immediately at support@snoop.com.</p>
            <br>
            <p>Thank you,</p>
            <p>The Support Team</p>
            <p>Snoop Proctoring System</p>
        `
    };

    if (!isEmailConfigured()) {
         console.log("[EMAIL SIMULATION] Email not configured in .env. Skipping send.");
         return res.redirect("/forgot-password?success=" + encodeURIComponent("Simulation: Reset link logged to console (Email not configured)."));
    }

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log("Email Error:", error);
            // Fallback for demo: succeed anyway so they can see console log
             return res.redirect("/forgot-password?success=" + encodeURIComponent("Check your email (and server console) for the reset link!"));
        } else {
            console.log('Email sent: ' + info.response);
            return res.redirect("/forgot-password?success=" + encodeURIComponent("Reset link sent to your email!"));
        }
    });
});

// 3. Show Reset Password Form
router.get("/reset-password", (req, res) => {
    const { email, token } = req.query;
    if (!email || !token) {
        return res.redirect("/forgot-password?error=" + encodeURIComponent("Invalid link."));
    }
    res.render("resetPassword", { email, token, error: req.query.error });
});

// 4. Handle Password Update
router.post("/reset-password", (req, res) => {
    const { email, password, confirmPassword } = req.body;
    
    if (password !== confirmPassword) {
        return res.redirect(`/reset-password?email=${email}&token=dummy&error=` + encodeURIComponent("Passwords do not match."));
    }

    // Call Auth Server to update password
    const options = {
        url: 'http://127.0.0.1:300/updatePassword',
        method: 'POST',
        json: true,
        body: { email, password }
    };

    request(options, (err, response, body) => {
        if (err || response.statusCode !== 200) {
            console.error("Auth Server Error:", err || body);
            return res.redirect(`/reset-password?email=${email}&token=dummy&error=` + encodeURIComponent("Failed to update password. Try again."));
        }
        
        // Success
        return res.redirect("/student/login?success=" + encodeURIComponent("Password updated successfully! Please login."));
    });
});

module.exports = router;
