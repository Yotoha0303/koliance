import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { buildVectors } from "./liquidation-vectors";

/**
 * GAP-06: the frontend's liquidation price and the contract's liquidation
 * verdict must agree, and until now nothing checked that they did.
 *
 * `liquidationPrice()` carries a comment claiming it matches the contract
 * "bit-for-bit". The demo's stated top risk is that it does not — a stage where
 * the panel says 176.42 and the chain liquidates at 176.41 destroys the
 * credibility of everything else on screen.
 *
 * This file is one half of the check: it pins the frontend's output against a
 * committed vector file. The other half is `contracts/test/perp/
 * LiquidationParity.ts`, which replays the same vectors on chain. Frontend
 * drift fails here; contract drift fails there; disagreement between the two
 * fails one of them.
 *
 * Regenerate after an intentional formula change:
 *
 *   UPDATE_VECTORS=1 npx vitest run tests/liquidation-parity.test.ts
 */

const VECTOR_PATH = "contracts/test/perp/fixtures/liquidation-vectors.json";

describe("liquidation price parity (GAP-06)", () => {
  it("frontend output matches the committed vectors", () => {
    const live = buildVectors();

    if (process.env.UPDATE_VECTORS === "1") {
      writeFileSync(
        VECTOR_PATH,
        JSON.stringify(
          {
            _comment:
              "Generated from src/lib/perp.ts via tests/liquidation-vectors.ts. Do not hand-edit. " +
              "The frontend test pins live output to this file; the contracts test replays it on chain.",
            vectors: live,
          },
          null,
          2
        ) + "\n"
      );
      console.log(`regenerated ${live.length} vectors`);
      return;
    }

    const committed = JSON.parse(readFileSync(VECTOR_PATH, "utf8")) as {
      vectors: typeof live;
    };

    // Compare as whole arrays: a mismatch anywhere is the signal, and printing
    // the first differing index is more useful than a diff of 60 objects.
    expect(live.length).toBe(committed.vectors.length);
    for (let i = 0; i < live.length; i++) {
      expect(live[i], `vector #${i} drifted`).toStrictEqual(committed.vectors[i]);
    }
  });

  it("covers both directions, both collateral sizes and the full leverage range", () => {
    // A grid that silently collapsed to one row would keep the parity test green
    // while checking almost nothing. Assert the shape of the coverage too.
    const v = buildVectors();
    expect(v.some((x) => x.isLong)).toBe(true);
    expect(v.some((x) => !x.isLong)).toBe(true);
    expect(new Set(v.map((x) => x.leverageBps)).size).toBe(5);
    expect(new Set(v.map((x) => x.collateralUsdc)).size).toBe(2);
    expect(v.length).toBe(60);
  });

  it("advertises a price at which the position is genuinely at the edge", () => {
    // A sanity check on the formula itself, independent of the contract: for a
    // long, the advertised liquidation price must sit BELOW the entry price, and
    // for a short above it. A sign error would still be self-consistent between
    // the two sides of this file but would liquidate every position instantly.
    for (const x of buildVectors()) {
      const liq = BigInt(x.liqPrice);
      const entry = BigInt(x.entryPrice);
      if (liq === 0n) continue; // collateral alone already covers it
      if (x.isLong) expect(liq).toBeLessThan(entry);
      else expect(liq).toBeGreaterThan(entry);
    }
  });
});
