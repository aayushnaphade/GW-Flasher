// Authentication Configuration
const AUTH_CONFIG = {
    // Basic credentials (change these!)
    username: 'admin',
    password: 'changeme123',
    
    // TOTP secret (generate from https://www.authenticator.cc/)
    totpSecret: 'JBSWY3DPEHPK3PXP', // Example secret - CHANGE THIS!
    
    // Session duration (24 hours)
    sessionDuration: 24 * 60 * 60 * 1000,
    
    // GitHub OAuth (optional - requires backend)
    githubClientId: '', // Set this if using GitHub OAuth
};

// Session management
const SESSION_KEY = 'gw_flasher_session';

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    
    setTimeout(() => {
        errorDiv.classList.remove('show');
    }, 5000);
}

function hideError() {
    const errorDiv = document.getElementById('error-message');
    errorDiv.classList.remove('show');
}

async function handleLogin(event) {
    event.preventDefault();
    hideError();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('login-btn');
    
    loginBtn.disabled = true;
    loginBtn.textContent = 'Checking...';
    
    // Simulate network delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (username === AUTH_CONFIG.username && password === AUTH_CONFIG.password) {
        // Basic auth passed, show TOTP if enabled
        if (AUTH_CONFIG.totpSecret) {
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('totp-section').classList.add('show');
            document.getElementById('totp-code').focus();
        } else {
            // No 2FA, grant access
            grantAccess();
        }
    } else {
        showError('Invalid username or password');
    }
    
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
}

async function handleTOTP(event) {
    event.preventDefault();
    hideError();
    
    const totpCode = document.getElementById('totp-code').value;
    
    if (!totpCode || totpCode.length !== 6) {
        showError('Please enter a 6-digit code');
        return;
    }
    
    // Verify TOTP code
    const isValid = await verifyTOTP(totpCode, AUTH_CONFIG.totpSecret);
    
    if (isValid) {
        grantAccess();
    } else {
        showError('Invalid or expired 2FA code');
        document.getElementById('totp-code').value = '';
        document.getElementById('totp-code').focus();
    }
}

function backToLogin() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('totp-section').classList.remove('show');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('totp-code').value = '';
    hideError();
}

function grantAccess() {
    // Create session
    const session = {
        authenticated: true,
        timestamp: Date.now(),
        expires: Date.now() + AUTH_CONFIG.sessionDuration
    };
    
    // Store in sessionStorage (more secure) and localStorage (for persistence)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    
    // Redirect to main page
    window.location.href = 'index.html';
}

function loginWithGitHub() {
    if (!AUTH_CONFIG.githubClientId) {
        showError('GitHub OAuth is not configured. Please use username/password login.');
        return;
    }
    
    // GitHub OAuth flow (requires backend to complete)
    const redirectUri = encodeURIComponent(window.location.origin + '/oauth-callback.html');
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${AUTH_CONFIG.githubClientId}&redirect_uri=${redirectUri}&scope=user:email`;
    
    window.location.href = githubAuthUrl;
}

// TOTP verification using HMAC-SHA1
async function verifyTOTP(token, secret) {
    try {
        // Get current time step (30 seconds)
        const timeStep = Math.floor(Date.now() / 1000 / 30);
        
        // Check current time step and adjacent ones (allow 30 second window)
        for (let i = -1; i <= 1; i++) {
            const code = await generateTOTP(secret, timeStep + i);
            if (code === token) {
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('TOTP verification error:', error);
        return false;
    }
}

async function generateTOTP(secret, timeStep) {
    // Decode base32 secret
    const key = base32Decode(secret);
    
    // Convert time step to 8-byte buffer
    const timeBuffer = new ArrayBuffer(8);
    const timeView = new DataView(timeBuffer);
    timeView.setBigUint64(0, BigInt(timeStep), false);
    
    // Import key for HMAC
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
    );
    
    // Generate HMAC
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, timeBuffer);
    const hmac = new Uint8Array(signature);
    
    // Dynamic truncation
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)
    );
    
    // Return 6-digit code
    return (code % 1000000).toString().padStart(6, '0');
}

function base32Decode(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    
    // Remove padding and convert to uppercase
    base32 = base32.replace(/=+$/, '').toUpperCase();
    
    // Convert each character to 5 bits
    for (let i = 0; i < base32.length; i++) {
        const val = alphabet.indexOf(base32[i]);
        if (val === -1) throw new Error('Invalid base32 character');
        bits += val.toString(2).padStart(5, '0');
    }
    
    // Convert bits to bytes
    const bytes = new Uint8Array(Math.floor(bits.length / 8));
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(bits.substr(i * 8, 8), 2);
    }
    
    return bytes;
}

// Check if already authenticated
function checkAuth() {
    const session = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    
    if (session) {
        try {
            const sessionData = JSON.parse(session);
            
            if (sessionData.authenticated && sessionData.expires > Date.now()) {
                // Valid session exists, redirect to main page
                window.location.href = 'index.html';
            } else {
                // Session expired
                sessionStorage.removeItem(SESSION_KEY);
                localStorage.removeItem(SESSION_KEY);
            }
        } catch (error) {
            console.error('Session check error:', error);
        }
    }
}

// Run auth check on page load
if (window.location.pathname.includes('auth.html')) {
    checkAuth();
}
