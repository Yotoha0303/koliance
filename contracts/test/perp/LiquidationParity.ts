import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { readFileSync } from "node:fs";

/**
 * GAP-06, the half that runs on chain.
 *
 * `src/lib/perp.ts` advertises a liquidation price and claims in a comment that
 * it agrees with the contract "bit-for-bit". The demo's own risk register calls
 * the opposite outcome the most classic way this kind of project falls over: a
 * panel that says 176.42 while the chain liquidates at 176.41, on stage, in
 * front of the people scoring it. Nothing checked the claim until now.
 *
 * `tests/liquidation-parity.test.ts` pins the frontend to a committed vector
 * file. This file reads the *same* file and replays each vector on chain: open
 * the position at the vector's entry price, then move the oracle to the price
 * the frontend advertised and ask the contract whether it would liquidate.
 *
 * So the two files compare three things between them:
 *
 *   frontend(live)  ==  vectors          -> fails in the frontend suite
 *   contract(chain) ==  vectors          -> fails here
 *   frontend        ==  contract         -> implied by both, and this is the one
 *                                           that matters
 *
 * Two deliberate constraints on the comparison:
 *
 *   - The funding rate is set to zero. The frontend's `liquidationPrice` models
 *     the price formula only, and funding is a separate term with its own
 *     frontend counterpart (`isLiquidatableWithFunding`, covered in
 *     `tests/perp.test.ts`). Leaving funding on would compare a funding-free
 *     number against a funding-bearing verdict and fail for a reason that has
 *     nothing to do with the formula under test.
 *   - Positions are opened through the plain self-serve path. The delegated path
 *     reaches the identical body, so pulling a registry in would add setup
 *     without changing the arithmetic being checked.
 */

const NVDA = "0xa470c4ac46f44b547b2cba52338f311fb642b79375ce5f0cfd5cb5b99227b852" as const;
const E6 = 10n ** 6n;

interface Vector {
  leverageBps: string;
  collateralUsdc: string;
  entryPrice: string;
  isLong: boolean;
  liqPrice: string;
}

const file = JSON.parse(
  readFileSync("test/perp/fixtures/liquidation-vectors.json", "utf8"),
) as { vectors: Vector[] };

describe("Liquidation parity: frontend price vs on-chain verdict (GAP-06)", async function () {
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

    // See the header note: the price formula is what is under test here.
    await pm.write.setFundingRatePerBlockWad([0n]);

    return { token, oracle, vault, pm, trader };
  }

  it("every advertised liquidation price is the price the chain actually liquidates at", async function () {
    assert.ok(file.vectors.length > 0, "no vectors — run the frontend parity test first");

    const mismatches: string[] = [];

    for (const v of file.vectors) {
      const ctx = await stack();
      const collateral = BigInt(v.collateralUsdc) * E6;
      const entryPrice = BigInt(v.entryPrice);
      const liqPrice = BigInt(v.liqPrice);
      const leverageBps = BigInt(v.leverageBps);

      await ctx.oracle.write.setPrice([NVDA, entryPrice]);
      await ctx.token.write.mint([ctx.trader.account.address, collateral]);
      await ctx.token.write.approve([ctx.pm.address, collateral], { account: ctx.trader.account });

      await ctx.pm.write.openPosition(
        [NVDA, collateral, leverageBps, v.isLong, []],
        { account: ctx.trader.account },
      );
      const id = 1n;

      // The stored collateral must be the same number the vector was computed
      // from, or the comparison is between two different positions.
      const p = await ctx.pm.read.getPosition([id]);
      const expectedCollateralUsd = collateral * 10n ** 12n;
      const expectedNet = expectedCollateralUsd - (expectedCollateralUsd * 10n) / 10_000n;
      assert.equal(
        p.collateralUsd,
        expectedNet,
        `vector ${JSON.stringify(v)}: stored collateral does not match the vector's basis`,
      );

      // Move to the advertised price and ask the chain for its verdict.
      await ctx.oracle.write.setPrice([NVDA, liqPrice]);
      const liquidatable = await ctx.pm.read.isLiquidatable([id]);

      if (!liquidatable) {
        // Report the actual equity so the failure says how far apart they are,
        // not merely that they differ.
        const equity = await ctx.pm.read.positionEquity([id]);
        mismatches.push(
          `leverage=${v.leverageBps} collateral=${v.collateralUsdc} entry=${v.entryPrice} ` +
            `isLong=${v.isLong} liq=${v.liqPrice} -> chain says NOT liquidatable (equity ${equity})`,
        );
      }
    }

    assert.equal(
      mismatches.length,
      0,
      `the frontend advertises a liquidation price the chain does not liquidate at ` +
        `(${mismatches.length}/${file.vectors.length} vectors):\n` +
        mismatches
          .slice(0, 6)
          .map((m) => `  ${m}`)
          .join("\n") +
        (mismatches.length > 6 ? `\n  ...and ${mismatches.length - 6} more` : ""),
    );
  });

  it("is not merely erring on the safe side — one wei better and it survives", async function () {
    // The previous test proves the advertised price is *at or through* the
    // boundary. On its own that would also pass a formula that liquidated a
    // little too early, which on stage reads as "the chain ate my position
    // before the number I was shown". This bounds it from the other side: one
    // wei further from the boundary and the position must still be alive.
    //
    // Only the boundary is asserted here, not the exact wei, because the
    // contract's comparison is `<=` and its divisions truncate — the honest
    // claim is "this is the boundary", not "this is the exact wei".
    const late: string[] = [];

    for (const v of file.vectors) {
      const ctx = await stack();
      const collateral = BigInt(v.collateralUsdc) * E6;
      const entryPrice = BigInt(v.entryPrice);
      const liqPrice = BigInt(v.liqPrice);
      const leverageBps = BigInt(v.leverageBps);

      await ctx.oracle.write.setPrice([NVDA, entryPrice]);
      await ctx.token.write.mint([ctx.trader.account.address, collateral]);
      await ctx.token.write.approve([ctx.pm.address, collateral], { account: ctx.trader.account });
      await ctx.pm.write.openPosition([NVDA, collateral, leverageBps, v.isLong, []], {
        account: ctx.trader.account,
      });

      // A long is liquidated as price falls, so "one wei safer" is one wei UP.
      // A short is the mirror.
      const safer = v.isLong ? liqPrice + 1n : liqPrice - 1n;
      if (safer <= 0n) continue;

      await ctx.oracle.write.setPrice([NVDA, safer]);
      if (await ctx.pm.read.isLiquidatable([1n])) {
        late.push(
          `leverage=${v.leverageBps} isLong=${v.isLong} liq=${v.liqPrice} -> liquidated at ${safer}, ` +
            `one wei the safer side of the advertised boundary`,
        );
      }
    }

    assert.equal(
      late.length,
      0,
      `the advertised price is not the boundary — the chain liquidates past it:\n` +
        late
          .slice(0, 6)
          .map((m) => `  ${m}`)
          .join("\n") +
        (late.length > 6 ? `\n  ...and ${late.length - 6} more` : ""),
    );
  });
});
