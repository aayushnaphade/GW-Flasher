/* Auth config — DEFAULT / local development values.
   At deploy, GitHub Actions (pages.yml) overwrites this file using the
   repo variables FLASHER_USERNAME, FLASHER_PASSWORD, and FLASHER_TOTP_SECRET.
   Do not store real production credentials here in the repo.

   totpSecret: base32 string (e.g. from an authenticator setup). Leave empty
   to disable the 2FA step. NOTE: on a static host this secret is visible in
   page source — it is access gating, not true 2FA. */
window.GW_AUTH = {
  username: "admin",
  password: "changeme123",
  totpSecret: "",
};
