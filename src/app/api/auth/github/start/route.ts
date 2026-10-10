import { NextRequest, NextResponse } from "next/server";
import { GITHUB_CLIENT_ID } from "@/lib/authConfig";
import {
  GITHUB_STATE_COOKIE,
  GITHUB_STATE_COOKIE_PATH,
  STATE_TTL_SECONDS,
  buildState,
  randomNonce,
  safeReturnPath,
} from "@/lib/oauthState";

/**
 * Starts the GitHub OAuth flow on the server so the CSRF nonce can live in an
 * httpOnly cookie the page's JavaScript never sees.
 *
 *   GET /api/auth/github/start?path=/agentcard[&client_id=<custom app id>]
 *
 * `client_id` keeps the existing "bring your own OAuth app" option working;
 * it is only used to build the GitHub authorize URL.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const path = safeReturnPath(url.searchParams.get("path") || "/agentcard");
  const custom = url.searchParams.get("client_id") || "";
  const clientId = /^[A-Za-z0-9._-]{1,64}$/.test(custom)
    ? custom
    : process.env.GITHUB_CLIENT_ID || GITHUB_CLIENT_ID;

  const nonce = randomNonce();
  const state = buildState(nonce, url.origin, path);

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("prompt", "select_account");
  authorize.searchParams.set("state", state);

  const res = NextResponse.redirect(authorize.toString(), 302);
  res.cookies.set(GITHUB_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: GITHUB_STATE_COOKIE_PATH,
    maxAge: STATE_TTL_SECONDS,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
