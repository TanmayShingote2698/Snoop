const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    // Determine where to redirect based on requested URL or default to general login logic?
    // For now, simple redirect to home -> which might redirect to specific login
    // Or we can let the router handle specific redirects if needed, but here we just block access.
    // Better: If trying to access /teacher/*, redirect to /teacher/login
    // If trying to access /student/*, redirect to /student/login
    
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
