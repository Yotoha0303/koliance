/**
 * OAuth `state` handling for the GitHub login (isomorphic: used by the route
 * handlers and by the callback relay in the browser).
 *
 * Format: `<nonce>.<base64url(JSON{o: origin, p: path})>`
 *
 *  - `nonce` is 32 random bytes. The server puts the same nonce in an httpOnly
 *    cookie when the flow starts (/api/auth/github/start) and the exchange
 *    route refuses a code unless state and cookie match. That is the CSRF
 *    protection the old state (a forgeable `{origin, path, t}` blob) never had.
 *  - `o`/`p` say where to bounce the user back to when GitHub redirects to a
 *    different registered domain. The relay only goes to an EXACT origin from
 *    the allow-list below; the old `*.vercel.app` / `*.oodai.space` / any
 *    localhost port wildcards let anyone with a free Vercel subdomain receive
 *    a victim's authorization code.
 */

export const GITHUB_STATE_COOKIE = "koliance_gh_oauth_state";
export const GITHUB_STATE_COOKIE_PATH = "/api/auth/github";
export const STATE_TTL_SECONDS = 600;

const DEFAULT_RELAY_ORIGINS = [
  "https://koliance.oodai.space",
  "https://koliance.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

/** Exact-match allow-list, extendable via NEXT_PUBLIC_OAUTH_RELAY_ORIGINS. */
export function trustedRelayOrigins(extra = process.env.NEXT_PUBLIC_OAUTH_RELAY_ORIGINS): string[] {
  const fromEnv = (extra || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter((o) => /^https?:\/\/[^/*\s]+$/.test(o));
  return Array.from(new Set([...DEFAULT_RELAY_ORIGINS, ...fromEnv]));
}

export function isTrustedRelayOrigin(origin: unknown, list = trustedRelayOrigins()): origin is string {
  return typeof origin === "string" && list.includes(origin);
}

/** Only same-site absolute paths; anything else falls back to /agentcard. */
export function safeReturnPath(p: unknown): string {
  if (typeof p !== "string" || !p.startsWith("/") || p.startsWith("//") || p.includes("\\")) {
    return "/agentcard";
  }
  return p.slice(0, 200);
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function randomNonce(): string {
  const b = new Uint8Array(32);
  globalThis.crypto.getRandomValues(b);
  let bin = "";
  b.forEach((x) => (bin += String.fromCharCode(x)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function buildState(nonce: string, origin: string, path: string): string {
  return `${nonce}.${toBase64Url(JSON.stringify({ o: origin, p: safeReturnPath(path) }))}`;
}

export interface ParsedState {
  nonce: string;
  origin?: string;
  path: string;
}

export function parseState(state: unknown): ParsedState | null {
  if (typeof state !== "string" || state.length > 1024) return null;
  const dot = state.indexOf(".");
  if (dot <= 0) return null;
  const nonce = state.slice(0, dot);
  if (!/^[A-Za-z0-9_-]{32,}$/.test(nonce)) return null;
  try {
    const data = JSON.parse(fromBase64Url(state.slice(dot + 1)));
    return {
      nonce,
      origin: typeof data?.o === "string" ? data.o : undefined,
      path: safeReturnPath(data?.p),
    };
  } catch {
    return null;
  }
}

/** Length-independent comparison of two strings. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** True only if the state parses and its nonce matches the cookie nonce. */
export function stateMatchesCookie(state: unknown, cookieNonce: string | undefined): boolean {
  const parsed = parseState(state);
  if (!parsed || !cookieNonce) return false;
  return timingSafeEqualStr(parsed.nonce, cookieNonce);
}

/**
 * Browser side of the callback: if GitHub landed us on a different registered
 * domain than the one that started the flow, return the URL to bounce to
 * (code AND state carried along, so the originating domain can verify the
 * state against its own cookie). Returns null when no relay is needed/allowed.
 */
export function relayTarget(currentOrigin: string, code: string, rawState: string | null): string | null {
  if (!rawState) return null;
  const parsed = parseState(rawState);
  if (!parsed?.origin || parsed.origin === currentOrigin || !isTrustedRelayOrigin(parsed.origin)) return null;
  const qs = new URLSearchParams({ code, state: rawState });
  return `${parsed.origin}${parsed.path}?${qs.toString()}`;
}
