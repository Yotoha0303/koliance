import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

/**
 * The rehearsal, as a test.
 *
 * `docs/planning/推进方案.md` §阶段 3.5 lists a five-step walkthrough that has
 * to run clean end to end before the demo is shown to anyone: connect, seed,
 * open twenty mixed positions, drop the price, watch the batch clear. Every
 * piece of that exists and has its own tests, but **nothing has ever run the
 * sequence**, and a sequence is not the sum of its parts — this is the one
 * place a demo actually fails.
 *
 * So this file is the walkthrough, executed. It reproduces `demo-seed.ts`'s
 * sizing and then does what the operator does on stage.
 *
 * ---------------------------------------------------------------------------
 * The finding worth reading: funding at the demo's own setting is a clock
 *
 * `demo-seed.ts` raises the funding rate to the ceiling (1e13 WAD/block) so the
 * mechanism is visible over a demo-length run. That is deliberate and correct
 * for showing funding. It also means the crowded side bleeds margin *on its
 * own*, with no price move at all, and the numbers below say how fast:
 *
 *   50x, 999 net collateral, size 49,950 USD
 *   skew +0.4 (14 long / 6 short)
 *   funding owed per block = size * rate * skew / WAD   ~= 0.2 USD
 *   maintenance margin     = 1% of size                 = 499.5 USD
 *
 *   => roughly 2,500 blocks of headroom, about 42 minutes at 1s per block on
 *      Monad. After that the longs are liquidatable on funding alone, before
 *      anyone touches the price.
 *
 * For a demo that runs in minutes this is fine and even useful — it makes
 * funding visible without a price move. For a demo that stalls, it is the
 * positions quietly clearing themselves off-screen while the presenter talks.
 * The last test below pins the number so the budget is a measurement rather
 * than an assumption.
 */

const BPS = 10_000n;
const E6 = 10n ** 6n;
const E18 = 10n ** 18n;

const NVDA = "0xa470c4ac46f44b547b2cba52338f311fb642b79375ce5f0cfd5cb5b99227b852" as const;

// These three must stay equal to demo-seed.ts. If the seed changes, this file
// is the tripwire.
const POSITION_COUNT = 20;
const LONG_COUNT = 14;
const COLLATERAL_USDC = 1_000n * E6;
const LEVERAGE_BPS = 500_000n;
const ENTRY_PRICE = 180n * E18;
const DEMO_FUNDING_RATE = 10_000_000_000_000n; // 1e13, the ceiling

/** demo-seed's liquidity formula, reproduced so the pool is sized the same way. */
function requiredLiquidityUsdc(): bigint {
  const gross = COLLATERAL_USDC;
  const fee = (gross * 10n) / BPS;
  const collateral = gross - fee;
  const size = (collateral * LEVERAGE_BPS) / BPS;
  const cap = collateral + size;
  return ((cap * BigInt(POSITION_COUNT)) * 120n) / 100n;
}

describe("Demo rehearsal: seed, drop the price, clear the batch", async function () {
  const { viem } = await network.getOrCreate();

  /** Stand the demo up exactly as `demo-seed.ts` does. */
  async function seed(opts: { fundingRate?: bigint } = {}) {
    const { fundingRate = 0n } = opts; // 0 unless a test wants the clock running
    const [deployer] = await viem.getWalletClients();

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

    const liquidity = requiredLiquidityUsdc();
    await token.write.mint([deployer.account.address, liquidity]);
    await token.write.approve([vault.address, liquidity]);
    await vault.write.addLiquidity([liquidity]);

    const capital = COLLATERAL_USDC * BigInt(POSITION_COUNT) * 2n;
    await token.write.mint([deployer.account.address, capital]);
    await token.write.approve([pm.address, capital]);

    await pm.write.setFundingRatePerBlockWad([fundingRate]);
    await oracle.write.setPrice([NVDA, ENTRY_PRICE]);

    return { token, oracle, vault, pm, deployer };
  }

  /** The operator's step 3: twenty mixed positions, 14 long and 6 short. */
  async function openBook(pm: Awaited<ReturnType<typeof seed>>["pm"], who: { account: unknown }) {
    for (let i = 0; i < POSITION_COUNT; i++) {
      await pm.write.openPosition([NVDA, COLLATERAL_USDC, LEVERAGE_BPS, i < LONG_COUNT, []], {
        account: who.account as never,
      });
    }
  }

  async function openIds(pm: Awaited<ReturnType<typeof seed>>["pm"]): Promise<bigint[]> {
    const next = (await pm.read.nextPositionId()) as bigint;
    const ids: bigint[] = [];
    // `openPosition` assigns `++nextPositionId`, so after N opens the counter
    // reads N and the valid ids are 1..N inclusive. `PositionPanel` loops the
    // same way; an exclusive bound here silently drops the last position.
    for (let id = 1n; id <= next; id++) {
      if ((await pm.read.isOpen([id])) as boolean) ids.push(id);
    }
    return ids;
  }

  it("the whole walkthrough runs: seed, drop 15%, one batch call clears the crowded side", async function () {
    const ctx = await seed();
    await openBook(ctx.pm, ctx.deployer);

    const ids = await openIds(ctx.pm);
    assert.equal(ids.length, 20, "the book must open all twenty, or the stage moment is smaller than scripted");

    // Solvency holds after seeding — demo-seed asserts this too, and it is the
    // invariant the whole guard suite exists for.
    const assets = (await ctx.vault.read.totalAssets()) as bigint;
    const reserved = (await ctx.pm.read.reservedAssets()) as bigint;
    assert.ok(assets >= reserved, `insolvent after seeding: ${assets} < ${reserved}`);

    // Nothing is liquidatable at the entry price. If this fails, the demo shows
    // its payoff before it starts.
    assert.equal(
      await ctx.pm.read.isLiquidatable([ids[0]]),
      false,
      "a position is liquidatable before the price moves",
    );

    // The operator's step 4: drop the price 15%. `bumpPrice` takes a bps delta,
    // so the panel never has to know the current price.
    await ctx.oracle.write.bumpPrice([NVDA, -1500n]);
    const [price] = (await ctx.oracle.read.getPrice([NVDA])) as [bigint, bigint];
    assert.equal(price, (ENTRY_PRICE * 8500n) / 10_000n, "the bump did not land where expected");

    // Which side is in trouble? A price drop kills the longs.
    const verdicts = await Promise.all(ids.map((id) => ctx.pm.read.isLiquidatable([id])));
    const liquidatable = ids.filter((_, i) => verdicts[i]);
    assert.equal(
      liquidatable.length,
      LONG_COUNT,
      `expected the ${LONG_COUNT} longs to be liquidatable and the shorts spared, got ${liquidatable.length}`,
    );

    // Step 4, the moment: ONE batched call over every id, as the panel sends.
    // Ids that should not be liquidated are skipped inside the contract rather
    // than reverting the batch, which is what makes sending all of them safe.
    await ctx.pm.write.liquidate([ids, []]);

    const stillOpen = await openIds(ctx.pm);
    assert.equal(
      stillOpen.length,
      POSITION_COUNT - LONG_COUNT,
      `expected the shorts to survive; ${stillOpen.length} positions remain`,
    );

    // And the survivors are the shorts, not an arbitrary subset.
    for (const id of stillOpen) {
      const p = await ctx.pm.read.getPosition([id]);
      assert.equal(p.isLong, false, `position ${id} is long and should have been liquidated`);
    }
  });

  it("the batch is one transaction, not twenty — the stage claim", async function () {
    // The pitch says "under a second". That is a throughput claim, and the thing
    // that makes it true is that the clear is a single call. If a future change
    // turned this into a loop, the claim would quietly become false, so the
    // shape is asserted rather than assumed.
    const ctx = await seed();
    await openBook(ctx.pm, ctx.deployer);
    const ids = await openIds(ctx.pm);
    await ctx.oracle.write.bumpPrice([NVDA, -1500n]);

    const client = await viem.getPublicClient();
    const before = await client.getBlockNumber();

    await ctx.pm.write.liquidate([ids, []]);

    const after = await client.getBlockNumber();
    // The local network advances one block per transaction; a loop would have
    // advanced by the number of liquidated positions.
    assert.ok(
      after - before <= 2n,
      `the batch took ${after - before} blocks — it is no longer one call`,
    );
  });

  it("refuses to open more than the pool can cover — the failure is loud, not silent", async function () {
    // The sizing formula exists because `openPosition` refuses anything the pool
    // cannot cap. A seed that got the arithmetic wrong should fail here rather
    // than produce a book that cannot be paid out.
    const [deployer] = await viem.getWalletClients();
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
    await oracle.write.setPrice([NVDA, ENTRY_PRICE]);

    // A pool one order of magnitude too small for twenty 50x positions.
    await token.write.mint([deployer.account.address, 100_000n * E6]);
    await token.write.approve([vault.address, 100_000n * E6]);
    await vault.write.addLiquidity([100_000n * E6]);

    const capital = COLLATERAL_USDC * BigInt(POSITION_COUNT) * 2n;
    await token.write.mint([deployer.account.address, capital]);
    await token.write.approve([pm.address, capital]);

    let refused = 0;
    for (let i = 0; i < POSITION_COUNT; i++) {
      try {
        await pm.write.openPosition([NVDA, COLLATERAL_USDC, LEVERAGE_BPS, true, []]);
      } catch (err) {
        const msg = String((err as Error).message);
        assert.ok(
          msg.includes("InsufficientPoolCapacity"),
          `expected a capacity refusal, got: ${msg.slice(0, 200)}`,
        );
        refused++;
      }
    }
    assert.ok(refused > 0, "an undersized pool accepted the whole book — the guard did not fire");
  });

  it("measures the funding clock the demo runs against", async function () {
    // See the header. At the demo's own funding setting the crowded side bleeds
    // margin with no price move, so the demo has a budget. This measures it
    // rather than asserting a remembered number.
    const ctx = await seed({ fundingRate: DEMO_FUNDING_RATE });
    await openBook(ctx.pm, ctx.deployer);
    const ids = await openIds(ctx.pm);
    const long = ids[0];

    const equity0 = (await ctx.pm.read.positionEquity([long])) as bigint;
    const owed0 = (await ctx.pm.read.fundingOwed([long])) as bigint;

    const client = await viem.getPublicClient();
    const start = await client.getBlockNumber();
    for (let i = 0; i < 50; i++) {
      await client.request({ method: "evm_mine" } as never);
    }
    const elapsed = (await client.getBlockNumber()) - start;

    const owed1 = (await ctx.pm.read.fundingOwed([long])) as bigint;
    const equity1 = (await ctx.pm.read.positionEquity([long])) as bigint;

    assert.ok(elapsed > 0n, "no blocks elapsed");
    assert.ok(owed1 > owed0, "a crowded long should be accruing funding it owes");
    assert.ok(equity1 < equity0, "funding did not reduce the position's equity");

    const perBlock = (owed1 - owed0) / elapsed;
    const sizeUsd = (await ctx.pm.read.getPosition([long])).sizeUsd as bigint;

    // Read the ratio from the deployment rather than hardcoding it: this is the
    // figure liquidation is actually decided on, so a contract whose ratio moved
    // must move this budget with it.
    const mmBps = (await ctx.pm.read.maintenanceMarginBps()) as bigint;
    const margin = (sizeUsd * mmBps) / BPS;

    const blocksToMargin = margin / (perBlock === 0n ? 1n : perBlock);

    // Record it. An operator should be able to read this out of the test log and
    // know how long the book survives without a price move.
    console.log(
      `
    funding clock: ~${Number(perBlock) / Number(E18)} USD/block on a ` +
        `${sizeUsd / E18} USD position;` +
        `
      maintenance margin ${margin / E18} USD (${mmBps} bps) -> ~${blocksToMargin} blocks` +
        ` (~${Math.round(Number(blocksToMargin) / 60)} min at 1s/block) before the longs go on` +
        ` funding alone.`,
    );

    // The order of magnitude is what matters — a change to the seed's rate or
    // leverage that silently collapsed the budget should fail here.
    assert.ok(
      blocksToMargin > 500n,
      `the funding clock is only ${blocksToMargin} blocks; the demo would clear itself mid-sentence`,
    );
  });
});
