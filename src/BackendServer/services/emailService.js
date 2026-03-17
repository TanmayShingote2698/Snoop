const nodemailer = require('nodemailer');
require('dotenv').config();

// Configure Transport
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, 
        pass: (process.env.EMAIL_PASS || '').replace(/\s+/g, '') // Remove spaces from App Password
    }
});

/**
 * Helper to check if email config is valid
 */
const isEmailConfigured = () => {
    return process.env.EMAIL_USER && 
           process.env.EMAIL_PASS && 
           process.env.EMAIL_USER !== 'your-email@gmail.com';
};

/**
 * Send Professional Test Invitation Email
 */
const sendTestInvitation = async (studentEmail, testID, accessCode, directLink, teacherName, testDetails = {}) => {
    if (!isEmailConfigured()) {
        console.log(`[EMAIL SIMULATION] To: ${studentEmail} | Test: ${testID} | Link: ${directLink} | Teacher: ${teacherName}`);
        return { success: true, simulated: true };
    }

    const { duration, startTime, endTime } = testDetails;
    const formattedStart = startTime ? new Date(startTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'As scheduled';
    const formattedEnd = endTime ? new Date(endTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'As scheduled';

    const mailOptions = {
        from: `"${teacherName} via Snoop" <no-reply@snoop.com>`,
        to: studentEmail,
        subject: `Invitation: Examination Login for ${testID}`,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 12px; padding: 0; color: #333; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                <div style="background: linear-gradient(135deg, #f472b6 0%, #db27bb 100%); padding: 30px; text-align: center; color: white;">
                    <h1 style="margin: 0; font-size: 24px; letter-spacing: 1px; text-transform: uppercase;">Snoop Proctoring</h1>
                    <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Secure Examination Invitation</p>
                </div>
                
                <div style="padding: 30px;">
                    <p style="font-size: 16px;">Hello,</p>
                    <p style="font-size: 15px; line-height: 1.5;">You have been invited by <strong>${teacherName}</strong> to participate in an online assessment. Please find the details below:</p>
                    
                    <div style="background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 8px; padding: 20px; margin: 25px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 5px 0; color: #701a75; font-size: 13px; width: 120px;">Test ID:</td>
                                <td style="padding: 5px 0; font-weight: 600;">${testID}</td>
                            </tr>
                            <tr>
                                <td style="padding: 5px 0; color: #701a75; font-size: 13px;">Access Code:</td>
                                <td style="padding: 5px 0; font-weight: 600; color: #db27bb; font-family: monospace; font-size: 16px;">${accessCode}</td>
                            </tr>
                            ${duration ? `<tr><td style="padding: 5px 0; color: #701a75; font-size: 13px;">Duration:</td><td style="padding: 5px 0; font-weight: 600;">${duration} Minutes</td></tr>` : ''}
                            <tr>
                                <td style="padding: 5px 0; color: #701a75; font-size: 13px;">Start Time:</td>
                                <td style="padding: 5px 0; font-weight: 600;">${formattedStart}</td>
                            </tr>
                            <tr>
                                <td style="padding: 5px 0; color: #701a75; font-size: 13px;">End Time:</td>
                                <td style="padding: 5px 0; font-weight: 600;">${formattedEnd}</td>
                            </tr>
                        </table>
                    </div>

                    <div style="text-align: center; margin: 35px 0;">
                        <a href="${directLink}" style="background: #db27bb; color: white; padding: 14px 35px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(219, 39, 187, 0.2);">JOIN EXAMINATION</a>
                    </div>

                    <div style="border-top: 1px solid #fce7f3; padding-top: 20px; margin-top: 10px;">
                        <p style="color: #db27bb; font-size: 14px; margin-bottom: 10px;"><strong>⚠️ PROCTORING RULES:</strong></p>
                        <ul style="font-size: 13px; color: #475569; padding-left: 20px; line-height: 1.6;">
                            <li>Browser must remain in Full-Screen mode.</li>
                            <li>AI will monitor face presence and gaze tracking.</li>
                            <li>Suspicious objects (phones, books) are strictly prohibited.</li>
                            <li>Tab switching will result in an immediate violation recording.</li>
                        </ul>
                    </div>
                </div>

                <div style="background: #fdf2f8; padding: 20px; text-align: center; font-size: 12px; color: #9d174d;">
                    If the button doesn't work, use this link: <br> 
                    <a href="${directLink}" style="color: #db27bb; word-break: break-all;">${directLink}</a>
                </div>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error("Email Error:", error);
        throw error;
    }
};

module.exports = {
    sendTestInvitation,
    isEmailConfigured
};
