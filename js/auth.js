/* ============================================================
   GW Flasher — login controller
   Credentials + TOTP secret are injected at deploy time from GitHub repo
   variables into window.GW_AUTH (see js/auth-config.js, written by pages.yml).

   SECURITY NOTE: GitHub Pages is fully static. Any value shipped to the
   browser — including the TOTP secret — is visible in page source. This is
   lightweight access gating, NOT real security/2FA. For true protection,
   put the site behind an authenticating proxy (e.g. Cloudflare Access).
   ============================================================ */

const SESSION_KEY = "gw_flasher_session";

const AUTH_CONFIG = {
  username: (window.GW_AUTH && window.GW_AUTH.username) || "admin",
  password: (window.GW_AUTH && window.GW_AUTH.password) || "changeme123",
  totpSecret: (window.GW_AUTH && window.GW_AUTH.totpSecret) || "",
  sessionDuration: 24 * 60 * 60 * 1000, // 24h
};

/* ---------- UI helpers ---------- */
function showError(message) {
  const box = document.getElementById("error-message");
  if (!box) return;
  box.textContent = message;
  box.classList.add("show");
  clearTimeout(showError._t);
  showError._t = setTimeout(() => box.classList.remove("show"), 5000);
}
function hideError() {
  document.getElementById("error-message")?.classList.remove("show");
}

function grantAccess() {
  const session = {
    authenticated: true,
    timestamp: Date.now(),
    expires: Date.now() + AUTH_CONFIG.sessionDuration,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.location.href = "index.html";
}

/* ---------- Step 1: username / password ---------- */
async function handleLogin(event) {
  event.preventDefault();
  hideError();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const btn = document.getElementById("login-btn");

  btn.disabled = true;
  btn.textContent = "Checking…";
  await new Promise((r) => setTimeout(r, 300));

  const ok = username === AUTH_CONFIG.username && password === AUTH_CONFIG.password;
  btn.disabled = false;
  btn.textContent = "Sign in";

  if (!ok) {
    showError("Invalid username or password.");
    return;
  }

  if (AUTH_CONFIG.totpSecret) {
    // Move to the 2FA step.
    document.getElementById("login-form").style.display = "none";
    document.getElementById("totp-section").classList.add("show");
    const code = document.getElementById("totp-code");
    code.value = "";
    code.focus();
  } else {
    grantAccess();
  }
}

/* ---------- Step 2: TOTP ---------- */
async function handleTOTP(event) {
  event.preventDefault();
  hideError();

  const input = document.getElementById("totp-code");
  const code = input.value.trim();
  const btn = document.getElementById("totp-btn");

  if (!/^\d{6}$/.test(code)) {
    showError("Enter the 6-digit code from your authenticator.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Verifying…";

  const valid = await verifyTOTP(code, AUTH_CONFIG.totpSecret);

  btn.disabled = false;
  btn.textContent = "Verify";

  if (valid) {
    grantAccess();
  } else {
    showError("Invalid or expired code. Check your device clock.");
    input.value = "";
    input.focus();
  }
}

function backToLogin() {
  hideError();
  document.getElementById("totp-section").classList.remove("show");
  document.getElementById("login-form").style.display = "block";
  document.getElementById("password").value = "";
  document.getElementById("totp-code").value = "";
  document.getElementById("username").focus();
}

/* ============================================================
   TOTP (RFC 6238) verification via Web Crypto HMAC-SHA1
   Accepts a ±1 time-step window (±30s) for clock drift.
   ============================================================ */
async function verifyTOTP(token, secret) {
  try {
    const step = Math.floor(Date.now() / 1000 / 30);
    for (let i = -1; i <= 1; i++) {
      const code = await generateTOTP(secret, step + i);
      if (code === token) return true;
    }
    return false;
  } catch (err) {
    console.error("TOTP verification error:", err);
    return false;
  }
}

async function generateTOTP(secret, step) {
  const key = base32Decode(secret);

  const timeBuffer = new ArrayBuffer(8);
  new DataView(timeBuffer).setBigUint64(0, BigInt(step), false);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );

  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, timeBuffer));
  const offset = sig[sig.length - 1] & 0x0f;
  const bin =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);

  return (bin % 1000000).toString().padStart(6, "0");
}

function base32Decode(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = base32.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = "";
  for (const ch of clean) {
    const val = alphabet.indexOf(ch);
    if (val === -1) throw new Error("Invalid base32 character in TOTP secret");
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substr(i * 8, 8), 2);
  }
  return bytes;
}

/* ---------- Already signed in? ---------- */
function checkAuth() {
  const session = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
  if (!session) return;
  try {
    const data = JSON.parse(session);
    if (data.authenticated && data.expires > Date.now()) {
      window.location.href = "index.html";
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  }
}

window.handleLogin = handleLogin;
window.handleTOTP = handleTOTP;
window.backToLogin = backToLogin;

if (window.location.pathname.includes("auth.html") || document.getElementById("login-form")) {
  checkAuth();
}
