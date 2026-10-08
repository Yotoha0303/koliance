import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/market/route";

/**
 * GAP-14: synthetic market data must be reproducible and must say it is synthetic.
 *
 * The route has three sources and two of them generate their series locally.
 * Both used `Math.random()`, which meant two refreshes of the same page showed
 * two different price histories — impossible to verify and, in a project whose
 * argument is that a judge should be able to verify what is on screen,
 * self-defeating. The `source` field was also in the payload and never rendered,
 * so a generated series appeared under the words "Real-time Technical Analysis".
 *
 * These assertions pin both halves. The first would have failed against the old
 * code on every run; the others pin the labelling so a future edit cannot quietly
 * drop it.
 */

function req(symbol: string) {
  return new NextRequest(`http://localhost/api/market?symbol=${symbol}&range=1mo&interval=1d`);
}

describe("market route — synthetic data is reproducible and labelled (GAP-14)", () => {
  beforeEach(() => {
    // Force the upstream-miss path. The fallback is where the synthetic series
    // is generated, so this is the branch under test.
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline in test")));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the same series for the same request, twice in a row", async () => {
    const first = await (await GET(req("NVDA"))).json();
    const second = await (await GET(req("NVDA"))).json();

    // The whole point. With `Math.random()` these differ on every call.
    expect(second.chart.closes).toEqual(first.chart.closes);
    expect(second.chart.timestamps).toEqual(first.chart.timestamps);
    expect(second.meta.regularMarketPrice).toBe(first.meta.regularMarketPrice);
  });

  it("marks the fallback series as synthetic and says so in words", async () => {
    const body = await (await GET(req("NVDA"))).json();

    expect(body.synthetic).toBe(true);
    expect(body.source).toBe("synthetic_fallback");
    expect(typeof body.dataCaveat).toBe("string");
    expect(body.dataCaveat.length).toBeGreaterThan(20);
  });

  it("does not claim an oracle or a cache it does not have", async () => {
    // The old source names were the defect as much as the randomness was:
    // `monad_oracle_gatekeeper` and `cached_calibrated_mirror` both describe
    // machinery that is not present.
    const mon = await (await GET(req("MON-USD"))).json();
    const fb = await (await GET(req("NVDA"))).json();

    for (const body of [mon, fb]) {
      expect(body.source).not.toContain("oracle");
      expect(body.source).not.toContain("cached");
      expect(body.source).not.toContain("live");
      expect(body.synthetic).toBe(true);
    }
  });

  it("gives a different series to a different symbol", async () => {
    // Determinism must not collapse into the same numbers for everyone, or the
    // charts would all be identical and just as useless in a different way.
    const nvda = await (await GET(req("NVDA"))).json();
    const tsla = await (await GET(req("TSLA"))).json();

    expect(tsla.chart.closes).not.toEqual(nvda.chart.closes);
  });

  it("still validates the symbol and clamps the range", async () => {
    // Untouched behaviour, pinned so the determinism work did not loosen the
    // gatekeeping that was already there.
    const bad = await GET(new NextRequest("http://localhost/api/market?symbol=../etc/passwd"));
    expect(bad.status).toBe(400);

    const clamped = await (await GET(new NextRequest("http://localhost/api/market?symbol=NVDA&range=bogus"))).json();
    expect(clamped.chart.closes.length).toBeGreaterThan(0);
  });
});
