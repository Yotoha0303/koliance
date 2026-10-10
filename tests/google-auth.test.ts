import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// The route upserts into Supabase; tests must not touch a real database.
vi.mock("@/lib/db", () => ({ syncUserToDatabase: vi.fn(async (u: unknown) => u) }));

import { POST } from "@/app/api/auth/google/exchange/route";
import { checkGoogleIdTokenClaims } from "@/lib/googleIdToken";

const CLIENT_ID = "test-client.apps.googleusercontent.com";

function req(body: object) {
  return new NextRequest("http://localhost:3000/api/auth/google/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function tokenInfo(overrides: Record<string, unknown> = {}) {
  return {
    aud: CLIENT_ID,
    azp: CLIENT_ID,
    iss: "https://accounts.google.com",
    exp: String(Math.floor(Date.now() / 1000) + 600),
    sub: "1234567890",
    email: "someone@example.com",
    email_verified: "true",
    name: "Someone",
    ...overrides,
  };
}

function mockTokenInfo(info: object, ok = true) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(info), { status: ok ? 200 : 400 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_CLIENT_ID", CLIENT_ID);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Google OAuth API Route", () => {
  it("should reject requests without authorization code or id_token", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Missing authorization code or id_token/);
  });

  it("should reject an id_token tokeninfo refuses", async () => {
    mockTokenInfo({ error: "invalid_token" }, false);
    const res = await POST(req({ id_token: "invalid_mock_token_123" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeDefined();
  });

  it("rejects a valid Google token issued to ANOTHER app (aud mismatch)", async () => {
    mockTokenInfo(tokenInfo({ aud: "someone-elses-app.apps.googleusercontent.com" }));
    const res = await POST(req({ id_token: "t" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/audience/);
  });

  it("ignores a caller-supplied clientId when checking aud", async () => {
    const other = "attacker-app.apps.googleusercontent.com";
    mockTokenInfo(tokenInfo({ aud: other }));
    const res = await POST(req({ id_token: "t", clientId: other, clientSecret: "x" }));
    expect(res.status).toBe(401);
  });

  it("rejects wrong issuer and expired tokens", async () => {
    mockTokenInfo(tokenInfo({ iss: "https://evil.example" }));
    expect((await POST(req({ id_token: "t" }))).status).toBe(401);
    mockTokenInfo(tokenInfo({ exp: String(Math.floor(Date.now() / 1000) - 1) }));
    expect((await POST(req({ id_token: "t" }))).status).toBe(401);
  });

  it("accepts a token for this app", async () => {
    mockTokenInfo(tokenInfo());
    const res = await POST(req({ id_token: "t" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.profile.googleId).toBe("1234567890");
  });

  it.each(["someone@gmail.com", "dev@google.com", "x@github.com", "y@monad.xyz", "z@example.org"])(
    "gives %s the same baseline tier (no e-mail-domain bonus)",
    async (email) => {
      mockTokenInfo(tokenInfo({ email }));
      const res = await POST(req({ id_token: "t" }));
      expect(res.status).toBe(200);
      const { profile } = await res.json();
      expect(profile.trustTier).toBe("GOOGLE VERIFIED CITIZEN");
      expect(profile.creditAllowanceUSD).toBe(600);
    }
  );

  it("keeps the demo token path unchanged (wallet login is a later task)", async () => {
    const res = await POST(req({ id_token: "demo_verified_google_identity" }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});

describe("checkGoogleIdTokenClaims", () => {
  const now = 1_700_000_000;
  const base = { aud: "a", iss: "accounts.google.com", exp: String(now + 1), sub: "s", email: "e@x" };
  it("passes a well-formed token", () => {
    expect(checkGoogleIdTokenClaims(base, "a", now)).toEqual({ ok: true });
  });
  it.each([
    [{ aud: "b" }, "audience"],
    [{ iss: "google.com" }, "issuer"],
    [{ exp: String(now) }, "expired"],
    [{ exp: "nope" }, "expired"],
    [{ sub: "" }, "subject"],
    [{ email: undefined }, "email"],
  ])("rejects %o", (patch, reason) => {
    const r = checkGoogleIdTokenClaims({ ...base, ...patch }, "a", now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(reason);
  });
  it("fails closed with no configured client ID", () => {
    expect(checkGoogleIdTokenClaims(base, "", now).ok).toBe(false);
  });
});
