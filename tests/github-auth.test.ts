import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as start } from "@/app/api/auth/github/start/route";
import { POST as exchange } from "@/app/api/auth/github/exchange/route";
import { GITHUB_STATE_COOKIE, parseState } from "@/lib/oauthState";

function exchangeReq(body: object, cookie?: string) {
  return new NextRequest("https://koliance.oodai.space/api/auth/github/exchange", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: `${GITHUB_STATE_COOKIE}=${cookie}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function mockGitHub() {
  const fetchMock = vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes("/login/oauth/access_token")) return Response.json({ access_token: "gho_test" });
    if (u.endsWith("/user")) return Response.json({ login: "octocat", public_repos: 1 });
    if (u.includes("/user/repos")) return Response.json([]);
    throw new Error(`unexpected fetch ${u}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("GitHub OAuth state (CSRF)", () => {
  it("start route sets an httpOnly nonce cookie that matches the state it sends to GitHub", async () => {
    const res = await start(new NextRequest("https://koliance.oodai.space/api/auth/github/start?path=/agentcard"));
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.origin + loc.pathname).toBe("https://github.com/login/oauth/authorize");
    const state = loc.searchParams.get("state")!;
    const cookie = res.cookies.get(GITHUB_STATE_COOKIE)!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(parseState(state)?.nonce).toBe(cookie.value);
    expect(parseState(state)?.origin).toBe("https://koliance.oodai.space");
  });

  it("start route ignores a malicious return path", async () => {
    const res = await start(new NextRequest("https://koliance.oodai.space/api/auth/github/start?path=//evil.com"));
    const state = new URL(res.headers.get("location")!).searchParams.get("state")!;
    expect(parseState(state)?.path).toBe("/agentcard");
  });

  it("exchange refuses a code without state, without cookie, or with a mismatched state", async () => {
    const fetchMock = mockGitHub();
    const startRes = await start(new NextRequest("https://koliance.oodai.space/api/auth/github/start"));
    const state = new URL(startRes.headers.get("location")!).searchParams.get("state")!;
    const nonce = startRes.cookies.get(GITHUB_STATE_COOKIE)!.value;

    for (const [body, cookie] of [
      [{ code: "c" }, nonce],
      [{ code: "c", state }, undefined],
      [{ code: "c", state }, "x".repeat(43)],
      [{ code: "c", state: "forged.state" }, nonce],
    ] as const) {
      const res = await exchange(exchangeReq(body, cookie));
      expect(res.status).toBe(403);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exchange proceeds when state matches the cookie, then clears the cookie", async () => {
    const fetchMock = mockGitHub();
    const startRes = await start(new NextRequest("https://koliance.oodai.space/api/auth/github/start"));
    const state = new URL(startRes.headers.get("location")!).searchParams.get("state")!;
    const nonce = startRes.cookies.get(GITHUB_STATE_COOKIE)!.value;

    const res = await exchange(exchangeReq({ code: "c", state }, nonce));
    expect(res.status).toBe(200);
    expect((await res.json()).stats.username).toBe("octocat");
    expect(fetchMock).toHaveBeenCalled();
    expect(res.cookies.get(GITHUB_STATE_COOKIE)?.value).toBe("");
  });
});
