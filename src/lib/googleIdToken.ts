/**
 * Claim checks for a Google ID token returned by the tokeninfo endpoint.
 *
 * tokeninfo only proves Google signed the token. It does NOT prove the token
 * was issued to *this* app: an ID token minted for any other site the user
 * signed into carries the same `sub`/`email`. Without the `aud` check, any
 * third-party app could replay its users' tokens here and log in as them.
 */

export const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

export interface GoogleTokenInfo {
  aud?: unknown;
  azp?: unknown;
  iss?: unknown;
  exp?: unknown;
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  picture?: unknown;
}

export type ClaimCheck = { ok: true } | { ok: false; reason: string };

export function checkGoogleIdTokenClaims(
  info: GoogleTokenInfo,
  expectedClientId: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): ClaimCheck {
  if (!expectedClientId) return { ok: false, reason: "server Google client ID not configured" };
  if (info.aud !== expectedClientId) return { ok: false, reason: "audience mismatch" };
  if (typeof info.iss !== "string" || !GOOGLE_ISSUERS.includes(info.iss)) {
    return { ok: false, reason: "issuer mismatch" };
  }
  const exp = typeof info.exp === "string" ? Number(info.exp) : info.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= nowSeconds) {
    return { ok: false, reason: "token expired" };
  }
  if (typeof info.sub !== "string" || info.sub === "") return { ok: false, reason: "missing subject" };
  if (typeof info.email !== "string" || info.email === "") return { ok: false, reason: "missing email" };
  return { ok: true };
}
