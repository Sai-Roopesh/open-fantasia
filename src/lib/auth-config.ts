/**
 * Single-user authentication configuration.
 *
 * This app is private and single-user. There is no sign-up and no credential is
 * stored in any database — the one allowed identity is hardcoded here (and can be
 * overridden via env for deployments). The fixed user id is the owner of every
 * row in the app's Supabase tables (see the `profiles` seed in the
 * `single_user_auth` migration).
 */

export const AUTH_USERNAME = (process.env.AUTH_USERNAME ?? "roops21").trim();
export const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? "chinnu21$";

/**
 * Stable UUID standing in for the single user. Used as `user.id` everywhere the
 * app scopes data with `.eq("user_id", ...)`, and seeded as the lone `profiles`
 * row so the app tables' foreign keys resolve.
 */
export const FIXED_USER_ID = "00000000-0000-4000-8000-0000000f0001";
export const FIXED_USER_EMAIL = AUTH_USERNAME;

export const SESSION_COOKIE = "of_session";

const FALLBACK_SESSION_SECRET = "open-fantasia-single-user-session-secret-v1";

/**
 * Secret used to HMAC-sign the session cookie. Prefers a dedicated env var, then
 * reuses the app encryption key, and finally falls back to a built-in constant so
 * the app still works out of the box for a private single-user deployment.
 */
export function getSessionSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET?.trim() ||
    process.env.APP_ENCRYPTION_KEY?.trim() ||
    FALLBACK_SESSION_SECRET
  );
}
