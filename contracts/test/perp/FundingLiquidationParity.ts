import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { readFileSync } from "node:fs";

/**
 * GAP-37, the half that runs on chain.
 *
 * The panel used to show a "可清算" badge driven by the chain's verdict (funding
 * included) beside an estimated liquidation price computed without funding. With
 * funding non-zero the two could disagree on one screen. `liquidationPrice` was
 * pinned to the chain by GAP-06, but that test sets the funding rate to ZERO
 * before comparing, so the funding term had no cross-boundary check at all.
 *
 * This file closes that: it reads the same vector file as
 * `tests/liquidation-funding-parity.test.ts` and replays each vector on chain,
 * this time with funding actually accruing.
 *
 * Two things are checked per vector, and the first is what keeps the second
 * honest:
 *
 *   1. the contract's own `fundingOwed` equals the `fundingOwedUsd` the frontend
 *      derived from `elapsedBlocks` and `fundingRateWad`. The funding amount is
 *      never handed to the contract — it is produced by accruing for that many
 *      blocks — so a drift in either side's funding arithmetic fails here rather
 *      than being papered over;
 *   2. at the price the frontend advertises, the chain's verdict matches.
 *
 * On why funding is accrued by calling `accrueFunding` repeatedly instead of
 * mining: `_projectedFundingIndex` returns the stored index unchanged when the
 * last accrual happened in the current block. Mining between blocks therefore
 * leaves the elapsed count one short of what a miner's intuition expects, and an
 * off-by-one there would make the two sides disagree for a reason that has
 * nothing to do with the formula under test. Calling `accrueFunding` once per
 * block makes `elapsed` exactly the vector's `elapsedBlocks`.
 *
 * On why the rate is set BEFORE opening: a position records the funding index at
 * open, and the first accrual for a feed only seeds the clock. Setting the rate
 * afterwards would charge the position for a window it was not open for.
 *
 * On why each vector opens exactly ONE position: a one-sided book has a skew of
 * exactly +/-WAD, which collapses the per-block delta to `elapsed * rate` with no
 * dependence on the book's size. A two-sided book would make the accrued amount
 * depend on open interest the vector would have to reproduce exactly.
 *
 * The consequence is that every vector's position is on the crowded side and
 * therefore PAYS. The receive side is covered in `tests/perp.test.ts`, which can
 * hold funding as a number without needing the contract to produce it.
 */

const NVDA = "0xa470c4ac46f44b547b2cba52338f311fb642b79375ce5f0cfd5cb5b99227b852" as const;
const E6 = 10n ** 6n;

interface Vector {
  leverageBps: string;
  collateralUsdc: string;
  entryPrice: string;
  isLong: boolean;
  elapsedBlocks: string;
  fundingRateWad: string;
  fundingOwedUsd: string;
  liqPrice: string;
}

const file = JSON.parse(
  readFileSync("test/perp/fixtures/liquidation-funding-vectors.json", "utf8"),
) as { vectors: Vector[] };

describe("Funding-aware liquidation parity: frontend price vs on-chain verdict (GAP-37)", async function () {
  const { viem } = await network.getOrCreate();

  /** Fresh stack per vector, so pool capacity and open interest cannot leak across. */
  async function stack() {
    const [deployer, lp, trader] = await viem.getWalletClients();

    const token = await viem.deployContract("MockUSDC");
    const oracle = await viem.deployContract("DemoOracle");
    const vault = await viem.deployContract("Vault", [token.address, deployer.account.address]);
    const pm = await viem.deployContract("PositionManager", [
      vault.address,
      oracle.address,
      token.address,
      deployer.account.address,
    ]);
    await vault.write.setPositionManager([pm.address]);

    // Deep pool: a 50x position's payout cap is ~51x its collateral, and the
    // pool must be able to cover it or the open is refused for a reason that is
    // not the formula under test.
    await token.write.mint([lp.account.address, 5_000_000n * E6]);
    await token.write.approve([vault.address, 5_000_000n * E6], { account: lp.account });
    await vault.write.addLiquidity([5_000_000n * E6], { account: lp.account });

    return { token, oracle, vault, pm, trader };
  }

  /** Advance the funding clock exactly `blocks` times, one block per call. */
  async function accrueBlocks(pm: any, blocks: bigint) {
    for (let i = 0n; i < blocks; i++) {
      await pm.write.accrueFunding([NVDA]);
    }
  }

  it("the contract's fundingOwed is what the frontend predicted, and the boundary holds", async function () {
    assert.ok(file.vectors.length > 0, "no vectors — run the frontend parity test first");

    const fundingMismatches: string[] = [];
    const boundaryMismatches: string[] = [];

    for (const v of file.vectors) {
      const ctx = await stack();
      const collateral = BigInt(v.collateralUsdc) * E6;
      const entryPrice = BigInt(v.entryPrice);
      const liqPrice = BigInt(v.liqPrice);
      const leverageBps = BigInt(v.leverageBps);
      const elapsed = BigInt(v.elapsedBlocks);
      const rate = BigInt(v.fundingRateWad);
      const label = `lev=${v.leverageBps} coll=${v.collateralUsdc} isLong=${v.isLong} elapsed=${v.elapsedBlocks}`;

      // Set the rate before the position exists, so it is charged for exactly
      // the blocks it was open for and no more.
      await ctx.pm.write.setFundingRatePerBlockWad([rate]);
      await ctx.oracle.write.setPrice([NVDA, entryPrice]);
      await ctx.token.write.mint([ctx.trader.account.address, collateral]);
      await ctx.token.write.approve([ctx.pm.address, collateral], { account: ctx.trader.account });
      await ctx.pm.write.openPosition([NVDA, collateral, leverageBps, v.isLong, []], {
        account: ctx.trader.account,
      });
      const id = 1n;

      // The stored collateral must be the same number the vector was computed
      // from, or the comparison is between two different positions.
      const p = await ctx.pm.read.getPosition([id]);
      const expectedCollateralUsd = collateral * 10n ** 12n;
      const expectedNet = expectedCollateralUsd - (expectedCollateralUsd * 10n) / 10_000n;
      assert.equal(
        p.collateralUsd,
        expectedNet,
        `${label}: stored collateral does not match the vector's basis`,
      );

      // Accrue for exactly the vector's window, then freeze the rate so the
      // figure cannot move between the assertion and the price comparison.
      await accrueBlocks(ctx.pm, elapsed);
      await ctx.pm.write.setFundingRatePerBlockWad([0n]);

      const owed = await ctx.pm.read.fundingOwed([id]);
      const expectedOwed = BigInt(v.fundingOwedUsd);
      if (owed !== expectedOwed) {
        fundingMismatches.push(`${label} -> chain owes ${owed}, frontend predicted ${expectedOwed}`);
      }

      // Move to the advertised price and ask the chain for its verdict.
      //
      // The contract's comparison is `equity <= mm`, so a position sitting exactly
      // ON its boundary is already liquidatable — the same convention GAP-06's
      // test uses for both directions. Asserting the boundary is therefore "the
      // chain liquidates here", not "the chain does not".
      await ctx.oracle.write.setPrice([NVDA, liqPrice]);
      const liquidatable = await ctx.pm.read.isLiquidatable([id]);

      if (!liquidatable) {
        const equity = await ctx.pm.read.positionEquity([id]);
        boundaryMismatches.push(
          `${label} liq=${v.liqPrice} owed=${owed} -> chain says NOT liquidatable at the ` +
            `advertised boundary (equity ${equity})`,
        );
      }
    }

    assert.equal(
      fundingMismatches.length,
      0,
      `the contract's funding disagrees with the frontend's funding arithmetic ` +
        `(${fundingMismatches.length}/${file.vectors.length} vectors):\n` +
        fundingMismatches.slice(0, 6).map((m) => `  ${m}`).join("\n"),
    );

    assert.equal(
      boundaryMismatches.length,
      0,
      `the advertised funding-aware liquidation price is not the boundary the chain uses ` +
        `(${boundaryMismatches.length}/${file.vectors.length} vectors):\n` +
        boundaryMismatches.slice(0, 6).map((m) => `  ${m}`).join("\n"),
    );
  });

  it("is not merely erring on the safe side — one wei better and the position survives", async function () {
    // The previous test proves the advertised price is AT the boundary. On its
    // own that would also pass a formula that liquidated a little too early,
    // which on stage reads as "the chain ate my position before the number I was
    // shown". This bounds it from the other side.
    //
    // Only the boundary is asserted, not the exact wei, because the contract
    // compares with `<=` and its divisions truncate — the honest claim is "this
    // is the boundary", not "this is the exact wei".
    const early: string[] = [];

    for (const v of file.vectors) {
      const ctx = await stack();
      const collateral = BigInt(v.collateralUsdc) * E6;
      const entryPrice = BigInt(v.entryPrice);
      const liqPrice = BigInt(v.liqPrice);
      const leverageBps = BigInt(v.leverageBps);

      await ctx.pm.write.setFundingRatePerBlockWad([BigInt(v.fundingRateWad)]);
      await ctx.oracle.write.setPrice([NVDA, entryPrice]);
      await ctx.token.write.mint([ctx.trader.account.address, collateral]);
      await ctx.token.write.approve([ctx.pm.address, collateral], { account: ctx.trader.account });
      await ctx.pm.write.openPosition([NVDA, collateral, leverageBps, v.isLong, []], {
        account: ctx.trader.account,
      });

      await accrueBlocks(ctx.pm, BigInt(v.elapsedBlocks));
      await ctx.pm.write.setFundingRatePerBlockWad([0n]);

      // A long is liquidated as price falls, so "one wei safer" is one wei UP.
      // A short is the mirror.
      const safer = v.isLong ? liqPrice + 1n : liqPrice - 1n;
      if (safer <= 0n) continue;

      await ctx.oracle.write.setPrice([NVDA, safer]);
      if (await ctx.pm.read.isLiquidatable([1n])) {
        early.push(
          `lev=${v.leverageBps} isLong=${v.isLong} elapsed=${v.elapsedBlocks} liq=${v.liqPrice} -> ` +
            `liquidated at ${safer}, one wei the safer side of the advertised boundary`,
        );
      }
    }

    assert.equal(
      early.length,
      0,
      `the advertised price is not the boundary — the chain liquidates past it:\n` +
        early.slice(0, 6).map((m) => `  ${m}`).join("\n"),
    );
  });
});
