import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { buildFundingVectors } from "./liquidation-funding-vectors";
import { liquidationPrice, liquidationPriceWithFunding, netCollateralUsd } from "@/lib/perp";
import { MAINTENANCE_MARGIN_BPS } from "@/lib/perpConfig";

/**
 * GAP-37: the panel showed two liquidation figures that could disagree — a badge
 * driven by the chain's verdict (funding included) beside a price computed
 * without funding. Nothing checked the funding term across the frontend/contract
 * boundary, which is exactly the term the two numbers differed by.
 *
 * This file is the frontend half of the check. `contracts/test/perp/
 * FundingLiquidationParity.ts` replays the same vectors on chain, where the
 * funding is driven by actually accruing it for `elapsedBlocks` rather than being
 * handed in as a number — so the vector's `fundingOwedUsd` is itself checked
 * against what the contract says the position owes.
 *
 * Regenerate after an intentional formula change:
 *
 *   UPDATE_FUNDING_VECTORS=1 npx vitest run tests/liquidation-funding-parity.test.ts
 */

const VECTOR_PATH = "contracts/test/perp/fixtures/liquidation-funding-vectors.json";

const E18 = 10n ** 18n;
const usdc = (n: bigint) => n * 10n ** 6n;

/** The PositionMath a vector describes, rebuilt from its own fields. */
function mathOf(v: ReturnType<typeof buildFundingVectors>[number]) {
  const grossUsd = usdc(BigInt(v.collateralUsdc)) * 10n ** 12n;
  return {
    collateralUsd: netCollateralUsd(grossUsd),
    entryPrice: BigInt(v.entryPrice),
    leverageBps: BigInt(v.leverageBps),
    isLong: v.isLong,
  };
}

describe("funding-aware liquidation price parity (GAP-37)", () => {
  it("agrees with the funding-free formula when nothing has accrued", () => {
    // The two functions must coincide at funding zero, or the panel's two
    // columns would disagree on an untouched position — the original GAP-37
    // symptom, reintroduced by the fix. These are the `elapsedBlocks === 0`
    // vectors; the 60 GAP-06 golden vectors protect the same invariant for the
    // funding-free function itself.
    for (const v of buildFundingVectors()) {
      if (BigInt(v.fundingOwedUsd) !== 0n) continue;
      const p = mathOf(v);
      expect(liquidationPriceWithFunding(p, 0n)).toBe(liquidationPrice(p));
      expect(BigInt(v.liqPrice)).toBe(liquidationPrice(p));
    }
  });

  it("frontend output matches the committed vectors", () => {
    const live = buildFundingVectors();

    if (process.env.UPDATE_FUNDING_VECTORS === "1") {
      writeFileSync(
        VECTOR_PATH,
        JSON.stringify(
          {
            _comment:
              "Generated from src/lib/perp.ts via tests/liquidation-funding-vectors.ts. Do not hand-edit. " +
              "The frontend test pins live output to this file; the contracts test replays it on chain, " +
              "accruing real funding for elapsedBlocks before comparing.",
            vectors: live,
          },
          null,
          2
        ) + "\n"
      );
      console.log(`regenerated ${live.length} funding vectors`);
      return;
    }

    const committed = JSON.parse(readFileSync(VECTOR_PATH, "utf8")) as {
      vectors: typeof live;
    };

    expect(live.length).toBe(committed.vectors.length);
    for (let i = 0; i < live.length; i++) {
      expect(live[i], `funding vector #${i} drifted`).toStrictEqual(committed.vectors[i]);
    }
  });

  it("covers both directions, zero and non-zero funding, and the full leverage range", () => {
    // A grid that collapsed to funding zero would keep this green while testing
    // nothing the GAP-06 vectors do not already test.
    const v = buildFundingVectors();
    expect(v.some((x) => x.isLong)).toBe(true);
    expect(v.some((x) => !x.isLong)).toBe(true);
    expect(v.some((x) => BigInt(x.fundingOwedUsd) === 0n)).toBe(true);
    expect(v.some((x) => BigInt(x.fundingOwedUsd) > 0n)).toBe(true);
    expect(new Set(v.map((x) => x.leverageBps)).size).toBe(2);
    expect(v.length).toBe(2 * 2 * 1 * 2 * 3);
  });

  it("moves the boundary toward the payer, and never past the entry price", () => {
    // Each vector opens a one-sided book, so the position is on the crowded side
    // and PAYS. A sign error here is self-consistent within this file but would
    // tell a trader being squeezed by carry that they have more room than they do.
    for (const v of buildFundingVectors()) {
      const p = mathOf(v);
      const base = liquidationPrice(p);
      const live = BigInt(v.liqPrice);
      const owed = BigInt(v.fundingOwedUsd);
      if (base === 0n || live === 0n) continue; // no positive boundary to compare

      if (owed > 0n) {
        // Pays: the boundary moves toward the entry price, i.e. sooner.
        if (v.isLong) expect(live).toBeGreaterThan(base);
        else expect(live).toBeLessThan(base);
      } else {
        expect(live).toBe(base);
      }

      // Whatever funding does, the boundary stays on the losing side of entry.
      const entry = BigInt(v.entryPrice);
      if (v.isLong) expect(live).toBeLessThan(entry);
      else expect(live).toBeGreaterThan(entry);
    }
  });

  it("is exactly the funding-free numerator plus funding, both branches", () => {
    // A direct read of the rearrangement, so a future refactor that changes the
    // operation order trips here rather than silently at the parity boundary.
    const collateralUsd = 1_000n * E18;
    const entryPrice = 200n * E18;
    const leverageBps = 100_000n; // 10x -> size = 10,000
    const funding = 33n * E18;

    const size = 10_000n * E18;
    // The constant, not a literal: hardcoding it here would be a second source
    // of truth for a number that already has one (D4).
    const mm = (size * MAINTENANCE_MARGIN_BPS) / 10_000n;

    expect(liquidationPrice({ collateralUsd, entryPrice, leverageBps, isLong: true })).toBe(
      (entryPrice * (mm - collateralUsd + size)) / size
    );
    expect(liquidationPriceWithFunding({ collateralUsd, entryPrice, leverageBps, isLong: true }, funding)).toBe(
      (entryPrice * (mm - collateralUsd + funding + size)) / size
    );

    // The short branch subtracts instead.
    expect(liquidationPrice({ collateralUsd, entryPrice, leverageBps, isLong: false })).toBe(
      (entryPrice * (collateralUsd + size - mm)) / size
    );
    expect(liquidationPriceWithFunding({ collateralUsd, entryPrice, leverageBps, isLong: false }, funding)).toBe(
      (entryPrice * (collateralUsd + size - mm - funding)) / size
    );
  });
});
