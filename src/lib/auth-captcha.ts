export const authCaptchaSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();

export function isAuthCaptchaConfigured() {
  return authCaptchaSiteKey.length > 0;
}
