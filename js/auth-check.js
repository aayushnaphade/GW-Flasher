// Authentication check for protected pages
const SESSION_KEY = 'gw_flasher_session';

function checkAuthentication() {
    // Skip auth check if on auth page
    if (window.location.pathname.includes('auth.html')) {
        return;
    }
    
    const session = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    
    if (!session) {
        // No session, redirect to login
        window.location.href = 'auth.html';
        return;
    }
    
    try {
        const sessionData = JSON.parse(session);
        
        if (!sessionData.authenticated || sessionData.expires < Date.now()) {
            // Session invalid or expired
            sessionStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(SESSION_KEY);
            window.location.href = 'auth.html';
            return;
        }
        
        // Session is valid, allow access
        console.log('Authentication verified');
        
    } catch (error) {
        console.error('Session validation error:', error);
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
        window.location.href = 'auth.html';
    }
}

function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'auth.html';
}

// Make logout available globally
window.logout = logout;

// Run authentication check immediately
checkAuthentication();
