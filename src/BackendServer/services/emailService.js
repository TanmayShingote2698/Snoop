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

/**
 * Send Detailed Student Performance & Integrity Report
 */
const sendStudentReportEmail = async (studentEmail, reportData) => {
    if (!isEmailConfigured()) {
        console.log(`[REPORT SIMULATION] To: ${studentEmail} | Report:`, reportData);
        return { success: true, simulated: true };
    }

    const { 
        testID, 
        studentName, 
        mcqScore, 
        totalQuestions,
        integrity, 
        cheatScore, 
        anomalies,
        teacherComment 
    } = reportData;

    const scorePercent = ((mcqScore / totalQuestions) * 100).toFixed(1);
    const riskLevel = cheatScore > 70 ? 'CRITICAL' : cheatScore > 40 ? 'HIGH' : cheatScore > 20 ? 'MODERATE' : 'LOW';
    const riskColor = cheatScore > 40 ? '#ef4444' : cheatScore > 20 ? '#f59e0b' : '#10b981';

    let anomaliesHtml = '';
    if (anomalies && anomalies.length > 0) {
        anomaliesHtml = `
            <div style="margin-top: 30px; border-top: 2px solid #f1f5f9; pt-20px;">
                <h3 style="color: #1e293b; font-size: 18px; margin-bottom: 15px;">Selected Evidence of Violations</h3>
                <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
        `;
        
        anomalies.forEach((anom, idx) => {
            anomaliesHtml += `
                <div style="background: #fffafa; border: 1px solid #fee2e2; border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <strong style="color: #b91c1c; font-size: 14px;">${anom.type.replace(/_/g, ' ').toUpperCase()}</strong>
                        <span style="color: #64748b; font-size: 12px;">${new Date(anom.timestamp).toLocaleString()}</span>
                    </div>
                    ${anom.imageUrl ? `
                        <div style="text-align: center; background: #000; border-radius: 8px; overflow: hidden; margin: 10px 0;">
                            <img src="${anom.imageUrl}" alt="Violation Capture" style="max-width: 100%; height: auto; display: block; margin: auto;">
                        </div>
                    ` : '<p style="color: #94a3b8; font-size: 12px; font-style: italic;">No image capture available for this event.</p>'}
                    <p style="margin: 5px 0 0; color: #475569; font-size: 13px;">Source: <strong>${anom.source || 'Camera'}</strong> | Confidence: ${(anom.confidence * 100).toFixed(0)}%</p>
                </div>
            `;
        });
        
        anomaliesHtml += `</div></div>`;
    }

    const mailOptions = {
        from: `"Snoop Examination System" <no-reply@snoop.com>`,
        to: studentEmail,
        subject: `Examination Report: ${testID}`,
        html: `
            <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 700px; margin: auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
                <div style="background: #1e293b; padding: 40px 30px; text-align: center; color: white;">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Examination Report</h1>
                    <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.8; font-weight: 500;">Test ID: ${testID}</p>
                </div>

                <div style="padding: 40px 35px;">
                    <p style="font-size: 18px; color: #334155;">Hello <strong>${studentName || studentEmail}</strong>,</p>
                    <p style="font-size: 15px; line-height: 1.6; color: #64748b; margin-bottom: 30px;">Your examination results and proctoring integrity analytics have been processed by the system. Below is your detailed performance report.</p>

                    <!-- Score Card -->
                    <div style="display: table; width: 100%; border-collapse: separate; border-spacing: 15px 0; margin-bottom: 30px;">
                        <div style="display: table-cell; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; text-align: center; width: 50%;">
                            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">MCQ Score</p>
                            <h2 style="margin: 10px 0 5px; font-size: 32px; color: #0f172a;">${mcqScore} <span style="font-size: 16px; color: #94a3b8;">/ ${totalQuestions}</span></h2>
                            <span style="background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">${scorePercent}% Perfect</span>
                        </div>
                        <div style="display: table-cell; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; text-align: center; width: 50%;">
                            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Integrity Score</p>
                            <h2 style="margin: 10px 0 5px; font-size: 32px; color: ${riskColor};">${integrity}%</h2>
                            <span style="background: ${riskColor}15; color: ${riskColor}; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">Risk: ${riskLevel}</span>
                        </div>
                    </div>

                    ${teacherComment ? `
                        <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 30px; border-left: 4px solid #1e293b;">
                            <p style="margin: 0 0 5px; font-size: 12px; font-weight: 700; color: #475569;">Teacher's Note:</p>
                            <p style="margin: 0; font-size: 15px; color: #1e293b; font-style: italic;">"${teacherComment}"</p>
                        </div>
                    ` : ''}

                    ${anomaliesHtml}

                    <div style="margin-top: 40px; text-align: center; padding: 25px; background: #f8fafc; border-radius: 12px;">
                        <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">This report was generated by the Snoop AI Proctoring System. The data presented here is used to maintain the highest standards of academic integrity.</p>
                    </div>
                </div>

                <div style="background: #1e293b; padding: 20px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; 2026 Snoop Proctoring | Secure, Intelligent, Fair.</p>
                </div>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error("Report Email Error:", error);
        throw error;
    }
};

module.exports = {
    sendTestInvitation,
    sendStudentReportEmail,
    isEmailConfigured
};
