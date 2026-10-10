import { describe, it, expect } from "vitest";
import {
  buildState,
  parseState,
  randomNonce,
  relayTarget,
  isTrustedRelayOrigin,
  trustedRelayOrigins,
  safeReturnPath,
  stateMatchesCookie,
} from "@/lib/oauthState";

describe("oauthState", () => {
  it("round-trips nonce, origin and path", () => {
    const n = randomNonce();
    const s = buildState(n, "https://koliance.oodai.space", "/agentcard");
    expect(parseState(s)).toEqual({ nonce: n, origin: "https://koliance.oodai.space", path: "/agentcard" });
  });

  it("nonces are random and long enough", () => {
    const a = randomNonce();
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(a).not.toEqual(randomNonce());
  });

  it("matches only the cookie nonce", () => {
    const n = randomNonce();
    const s = buildState(n, "https://koliance.oodai.space", "/");
    expect(stateMatchesCookie(s, n)).toBe(true);
    expect(stateMatchesCookie(s, randomNonce())).toBe(false);
    expect(stateMatchesCookie(s, undefined)).toBe(false);
    expect(stateMatchesCookie(undefined, n)).toBe(false);
    // The old forgeable format (base64 JSON with origin/path/t) must not pass.
    const legacy = btoa(JSON.stringify({ origin: "https://koliance.oodai.space", path: "/", t: 1 }));
    expect(stateMatchesCookie(legacy, n)).toBe(false);
  });

  it("relay allow-list is exact match only", () => {
    const list = trustedRelayOrigins("");
    for (const o of ["https://koliance.oodai.space", "https://koliance.vercel.app", "http://localhost:3000"]) {
      expect(isTrustedRelayOrigin(o, list)).toBe(true);
    }
    for (const o of [
      "https://evil.vercel.app",
      "https://attacker.oodai.space",
      "http://localhost:4444",
      "https://koliance.oodai.space.evil.com",
      "javascript:alert(1)",
    ]) {
      expect(isTrustedRelayOrigin(o, list)).toBe(false);
    }
    expect(trustedRelayOrigins("https://preview-x.vercel.app, *.vercel.app ,")).toContain("https://preview-x.vercel.app");
    expect(trustedRelayOrigins("*.vercel.app")).not.toContain("*.vercel.app");
  });

  it("relayTarget carries state and refuses untrusted origins", () => {
    const n = randomNonce();
    const good = buildState(n, "https://koliance.oodai.space", "/agentcard");
    const t = relayTarget("https://koliance.vercel.app", "abc", good)!;
    const u = new URL(t);
    expect(u.origin).toBe("https://koliance.oodai.space");
    expect(u.pathname).toBe("/agentcard");
    expect(u.searchParams.get("code")).toBe("abc");
    expect(u.searchParams.get("state")).toBe(good);

    const evil = buildState(n, "https://evil.vercel.app", "/agentcard");
    expect(relayTarget("https://koliance.vercel.app", "abc", evil)).toBeNull();
    expect(relayTarget("https://koliance.oodai.space", "abc", good)).toBeNull(); // same origin: no relay
    expect(relayTarget("https://koliance.vercel.app", "abc", null)).toBeNull();
  });

  it("sanitises return paths", () => {
    expect(safeReturnPath("/agentcard")).toBe("/agentcard");
    expect(safeReturnPath("//evil.com")).toBe("/agentcard");
    expect(safeReturnPath("https://evil.com")).toBe("/agentcard");
    expect(safeReturnPath("/\\evil.com")).toBe("/agentcard");
    expect(safeReturnPath(undefined)).toBe("/agentcard");
  });
});
