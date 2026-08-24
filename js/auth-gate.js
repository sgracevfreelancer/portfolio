// Client-side password gate. Read this comment before relying on it:
//
// This is a DETERRENT, not a security boundary. GitHub Pages (and any
// static host) serves every file to anyone who requests it, regardless of
// what JavaScript does after the page loads — there is no server here to
// actually refuse a request. What this script *does* provide:
//   - A lock screen that hides the page from casual visitors and stops
//     well-behaved search/AI crawlers that execute JavaScript from seeing
//     dynamically-loaded content (gallery grid, drafts grid) until unlocked.
//   - The password is never shipped in plaintext — only a salted PBKDF2
//     hash (250,000 iterations) is stored here, so reading this file only
//     gets you something that takes real, deliberate effort to reverse.
//   - A 7-day "remember me" cookie so the password isn't re-entered
//     constantly, and basic rate limiting (5 attempts / 3 minutes) against
//     casual guessing through the form.
// It will NOT stop someone who fetches the raw HTML directly (curl, a
// non-JS crawler, "view source") from reading whatever static text is
// already in that HTML — that's a hard limit of client-only auth on static
// hosting. Pair this with robots.txt (already added) to keep compliant
// search/AI crawlers from indexing the site in the first place.
//
(function () {
  const SALT_HEX = "6ee605a66347a6d384fa5a79b32c07ff";
  const EXPECTED_HASH_HEX =
    "86d0f0fdbbd2e10432f52f151de3faf068b0a59c37250ce4647d5d797dd65bce";
  const ITERATIONS = 250000;
  const KEY_LENGTH_BITS = 256;

  const COOKIE_NAME = "site_auth";
  const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

  const MAX_ATTEMPTS = 5;
  const ATTEMPT_WINDOW_MS = 3 * 60 * 1000; // 3 minutes
  const ATTEMPTS_KEY = "gate_attempts";

  const gate = document.getElementById("gate");
  const form = document.getElementById("gate-form");
  const input = document.getElementById("gate-input");
  const errorEl = document.getElementById("gate-error");
  const submitBtn = form ? form.querySelector("button[type=submit]") : null;

  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  function bytesToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function deriveHash(password) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    const derived = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: hexToBytes(SALT_HEX),
        iterations: ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      KEY_LENGTH_BITS
    );
    return bytesToHex(derived);
  }

  function getCookie(name) {
    const match = document.cookie.match(
      new RegExp("(?:^|; )" + name + "=([^;]*)")
    );
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCookie(name, value, maxAgeSeconds) {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${name}=${encodeURIComponent(
      value
    )}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax${secure}`;
  }

  function getAttempts() {
    let attempts = [];
    try {
      attempts = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || "[]");
    } catch (e) {
      attempts = [];
    }
    const cutoff = Date.now() - ATTEMPT_WINDOW_MS;
    return attempts.filter((ts) => ts > cutoff);
  }

  function recordAttempt() {
    const attempts = getAttempts();
    attempts.push(Date.now());
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
    return attempts;
  }

  function clearAttempts() {
    localStorage.removeItem(ATTEMPTS_KEY);
  }

  function lockoutRemainingMs() {
    const attempts = getAttempts();
    if (attempts.length < MAX_ATTEMPTS) return 0;
    const oldest = Math.min(...attempts);
    return Math.max(0, oldest + ATTEMPT_WINDOW_MS - Date.now());
  }

  function formatCountdown(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  let countdownTimer = null;

  function updateLockoutUI() {
    const remaining = lockoutRemainingMs();
    if (remaining > 0) {
      submitBtn.disabled = true;
      input.disabled = true;
      showMessage(`Too many attempts. Try again in ${formatCountdown(remaining)}.`);
      if (!countdownTimer) {
        countdownTimer = setInterval(() => {
          const left = lockoutRemainingMs();
          if (left <= 0) {
            clearInterval(countdownTimer);
            countdownTimer = null;
            submitBtn.disabled = false;
            input.disabled = false;
            hideMessage();
          } else {
            showMessage(`Too many attempts. Try again in ${formatCountdown(left)}.`);
          }
        }, 1000);
      }
      return true;
    }
    return false;
  }

  function showMessage(text) {
    if (!errorEl) return;
    errorEl.textContent = text;
    errorEl.hidden = false;
  }

  function hideMessage() {
    if (!errorEl) return;
    errorEl.hidden = true;
  }

  function deleteCookie(name) {
    document.cookie = `${name}=; max-age=0; path=/; SameSite=Lax`;
  }

  function hideGate() {
    document.body.classList.remove("locked");
    if (gate) gate.style.display = "none";
    window.dispatchEvent(new Event("site:unlocked"));
  }

  function unlock(hashHex) {
    setCookie(COOKIE_NAME, hashHex, COOKIE_MAX_AGE);
    clearAttempts();
    hideGate();
  }

  // Fast path: already unlocked this browser within the last 7 days.
  const cookieVal = getCookie(COOKIE_NAME);
  if (cookieVal && cookieVal === EXPECTED_HASH_HEX) {
    hideGate();
  }

  // Wire up the form regardless of current lock state so the unlock remains
  // available if the page is opened without a valid cookie.
  if (form) {
    updateLockoutUI();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideMessage();

      if (updateLockoutUI()) return;

      submitBtn.disabled = true;
      const hashHex = await deriveHash(input.value);
      submitBtn.disabled = false;

      if (hashHex === EXPECTED_HASH_HEX) {
        unlock(hashHex);
        return;
      }

      const attempts = recordAttempt();
      input.value = "";
      input.focus();
      if (attempts.length >= MAX_ATTEMPTS) {
        updateLockoutUI();
      } else {
        showMessage(
          `Wrong password. ${MAX_ATTEMPTS - attempts.length} attempt${
            MAX_ATTEMPTS - attempts.length === 1 ? "" : "s"
          } left before a 3-minute lockout.`
        );
      }
    });
  }

})();
