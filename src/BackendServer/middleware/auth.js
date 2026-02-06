const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    
    // Check if this is an API request (AJAX/JSON)
    const isAPIRequest = req.headers['content-type']?.includes('application/json') || 
                        req.headers['accept']?.includes('application/json') ||
                        req.path.includes('/api/') ||
                        req.path.includes('/generateQuestionsAI') ||
                        req.path.includes('/saveGeneratedTest');
    
    if (isAPIRequest) {
        // Return JSON error for API requests
        return res.status(401).json({
            success: false,
            error: 'Please log in to access this feature',
            requiresLogin: true
        });
    }
    
    // Redirect to login for page requests
    if (req.originalUrl.startsWith('/teacher')) {
        return res.redirect('/teacher/login?error=' + encodeURIComponent('Please log in to view this page.'));
    } else if (req.originalUrl.startsWith('/student')) {
        return res.redirect('/student/login?error=' + encodeURIComponent('Please log in to view this page.'));
    }
    res.redirect('/?error=' + encodeURIComponent('Please log in to view this page.'));
};

const checkNotAuthenticated = (req, res, next) => {
    if (req.session.user) {
        // Redirect to respective dashboard
        if (req.session.user.role === 'teacher') {
            return res.redirect('/teacher/home');
        } else if (req.session.user.role === 'student') {
            return res.redirect('/student/home');
        }
    }
    next();
};

module.exports = { checkAuthenticated, checkNotAuthenticated };
