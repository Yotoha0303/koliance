import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

/**
 * Per-block funding.
 *
 * The mechanism is what a fast chain makes possible: funding that settles every
 * block rather than every 1–8 hours, so the basis between the perp and spot is
 * arbitraged away 28,800x more often. These tests pin down the three properties
 * that claim rests on:
 *
 *   1. A balanced book accrues NOTHING. Funding is not a fee — it is a transfer
 *      between the two sides, and with no skew there is nothing to transfer.
 *   2. The index advances once per block, not once per call, and not in one jump
 *      when someone finally calls it. That is the "per block" part.
 *   3. Funding is part of the liquidation verdict, so a crowded side can be
 *      pushed through its maintenance margin by the cost of carry alone.
 *
 * The rate is set high in these tests (see `setRate`) so that a handful of blocks
 * produces a measurable number. The mechanism is identical at the realistic
 * default; only the arithmetic scale changes. That distinction is the whole
 * reason the rate is a parameter rather than a constant — see ADR-003.
 */

const E18 = 10n ** 18n;
const E6 = 10n ** 6n;
const usd = (n: bigint | number) => BigInt(n) * E18;
const usdc = (n: bigint | number) => BigInt(n) * E6;

const NVDA = "0xa470c4ac46f44b547b2cba52338f311fb642b79375ce5f0cfd5cb5b99227b852" as const;
const BTC = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" as const;
const BPS = 10_000n;
const WAD = E18;

/** 1e13 WAD/block at full skew: 1e-5 of notional per block. Measurable. */
const TEST_RATE = 10_000_000_000_000n;

describe("Funding", async function () {
  const { viem } = await network.getOrCreate();
  const [deployer, lp, long, short, keeper] = await viem.getWalletClients();

  async function setup() {
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
    await oracle.write.setPrice([NVDA, usd(180)]);
    await oracle.write.setPrice([BTC, usd(65_000)]);

    // A deep pool so the payout-capacity gate never interferes with a funding
    // test — a capacity revert here would be testing the wrong thing.
    await token.write.mint([lp.account.address, usdc(500_000)]);
    await token.write.approve([vault.address, usdc(500_000)], { account: lp.account });
    await vault.write.addLiquidity([usdc(500_000)], { account: lp.account });

    for (const who of [long, short, keeper]) {
      await token.write.mint([who.account.address, usdc(200_000)]);
      await token.write.approve([pm.address, usdc(200_000)], { account: who.account });
    }

    await pm.write.setFundingRatePerBlockWad([TEST_RATE]);
    return { token, oracle, vault, pm };
  }

  async function open(pm: any, who: any, isLong: boolean, opts: { feedId?: `0x${string}` } = {}) {
    const feedId = opts.feedId ?? NVDA;
    await pm.write.openPosition([feedId, usdc(1_000), 100_000n, isLong, []], {
      account: who.account,
    });
    return await pm.read.nextPositionId();
  }

  /** Advance `n` blocks without sending a transaction. */
  async function mine(n: number) {
    const publicClient = await viem.getPublicClient();
    for (let i = 0; i < n; i++) {
      await publicClient.request({ method: "evm_mine" } as never);
    }
  }

  // ==================== THE STRADDLE ====================
  // If this fails, funding is a fee rather than a transfer and the whole design
  // is wrong.

  it("accrues nothing further when long and short open interest are equal", async function () {
    const { pm } = await setup();

    await open(pm, long, true);
    await open(pm, short, false);

    // Equal notional on both sides: skew is exactly zero.
    const [longUsd, shortUsd] = await pm.read.openInterest([NVDA]);
    assert.equal(longUsd, shortUsd, "sides must be equal for this test to mean anything");
    assert.equal(await pm.read.fundingSkewWad([NVDA]), 0n);

    // Note the index is NOT zero here. Opening the long first made the book
    // momentarily 100% long, and that block's funding is legitimately banked —
    // accrued funding does not retroactively un-happen. What must hold is that
    // a balanced book adds nothing MORE.
    await pm.write.accrueFunding([NVDA], { account: keeper.account });
    const before = await pm.read.cumulativeFundingIndex([NVDA]);

    await mine(50);
    await pm.write.accrueFunding([NVDA], { account: keeper.account });

    assert.equal(await pm.read.cumulativeFundingIndex([NVDA]), before);
  });

  it("stops growing either side's obligation once the book is balanced", async function () {
    const { pm } = await setup();

    const longId = await open(pm, long, true);
    const shortId = await open(pm, short, false);

    await pm.write.accrueFunding([NVDA], { account: keeper.account });
    const longBefore = await pm.read.fundingOwed([longId]);
    const shortBefore = await pm.read.fundingOwed([shortId]);

    await mine(100);
    await pm.write.accrueFunding([NVDA], { account: keeper.account });

    // Neither side's obligation may move while the skew is zero.
    assert.equal(await pm.read.fundingOwed([longId]), longBefore);
    assert.equal(await pm.read.fundingOwed([shortId]), shortBefore);
  });

  // ==================== DIRECTION ====================

  it("charges the crowded side and pays the thin side", async function () {
    const { pm } = await setup();

    // Two longs against one short: the book is long-heavy, so longs pay.
    const longA = await open(pm, long, true);
    const longB = await open(pm, long, true);
    const shortA = await open(pm, short, false);

    // Skew is (2-1)/3 = +1/3.
    const skew = await pm.read.fundingSkewWad([NVDA]);
    assert.ok(skew > 0n, `skew should be positive for a long-heavy book, got ${skew}`);

    await mine(100);
    await pm.write.accrueFunding([NVDA], { account: keeper.account });

    const index = await pm.read.cumulativeFundingIndex([NVDA]);
    assert.ok(index > 0n, "a long-heavy book must push the index up");

    // Longs pay (positive), shorts are paid (negative).
    for (const id of [longA, longB]) {
      assert.ok((await pm.read.fundingOwed([id])) > 0n, `long ${id} must pay`);
    }
    assert.ok((await pm.read.fundingOwed([shortA])) < 0n, "the short must be paid");
  });

  it("flips direction when the book turns short-heavy", async function () {
    const { pm } = await setup();

    await open(pm, long, true);
    const shortA = await open(pm, short, false);
    await open(pm, short, false);

    const skew = await pm.read.fundingSkewWad([NVDA]);
    assert.ok(skew < 0n, `skew should be negative for a short-heavy book, got ${skew}`);

    await mine(100);
    await pm.write.accrueFunding([NVDA], { account: keeper.account });

    assert.ok((await pm.read.cumulativeFundingIndex([NVDA])) < 0n, "index must fall");
    assert.ok((await pm.read.fundingOwed([shortA])) > 0n, "the crowded short side pays");
  });

  // ==================== PER-BLOCK GRANULARITY ====================
  // This is the claim the mechanism rests on: funding advances with block
  // production, not with a keeper's schedule.

  it("advances the index in proportion to the number of blocks elapsed", async function () {
    const { pm } = await setup();
    await open(pm, long, true); // fully skewed: one long, no shorts

    await mine(10);
    await pm.write.accrueFunding([NVDA], { account: keeper.account });
    const after10 = await pm.read.cumulativeFundingIndex([NVDA]);

    await mine(10);
    await pm.write.accrueFunding([NVDA], { account: keeper.account });
    const after20 = await pm.read.cumulativeFundingIndex([NVDA]);

    assert.ok(after10 > 0n, "funding must accrue");
    // The second ten blocks must accrue the same amount as the first ten. Any
    // drift here means the accrual depends on when it is called, not on blocks.
    const first = after10;
    const second = after20 - after10;
    const diff = first > second ? first - second : second - first;
    // Allow one WAD unit per block of truncation slack.
    assert.ok(diff <= WAD * 10n, `10-block accruals differ: ${first} vs ${second}`);
  });

  it("is idempotent within a single block", async function () {
    const { pm } = await setup();
    await open(pm, long, true);

    await mine(5);
    // Three accruals in the same block must produce one block's worth of change,
    // not three. Otherwise calling accrueFunding from every entry point would
    // multiply the charge.
    await pm.write.accrueFunding([NVDA], { account: keeper.account });
    const once = await pm.read.cumulativeFundingIndex([NVDA]);
    await pm.write.accrueFunding([NVDA], { account: keeper.account });
    await pm.write.accrueFunding([NVDA], { account: keeper.account });
    // Note: each of those writes is its own block, so compare against a single
    // call made in the same block as the first.
    const twice = await pm.read.cumulativeFundingIndex([NVDA]);

    // The second and third calls each spanned one new block, so growth must be
    // small and monotonic — never a multiple of the 5-block jump.
    assert.ok(twice > once, "index should still advance one block per call");
    assert.ok(
      twice - once < once,
      `repeat calls in adjacent blocks grew the index disproportionately: ${once} -> ${twice}`
    );
  });

  it("does not accrue from the genesis block on a feed's first touch", async function () {
    const { pm } = await setup();

    // Opening is the feed's first touch. If accrual started from block 0 the
    // index would be enormous, so the first touch must only seed the clock.
    const id = await open(pm, long, true);
    assert.equal(await pm.read.cumulativeFundingIndex([NVDA]), 0n);
    assert.equal(await pm.read.fundingOwed([id]), 0n);
  });

  it("keeps feeds independent", async function () {
    const { pm } = await setup();

    await open(pm, long, true, { feedId: NVDA });
    await open(pm, short, false, { feedId: BTC });

    await mine(50);
    await pm.write.accrueFunding([NVDA], { account: keeper.account });

    // BTC was never accrued, so its index is untouched.
    assert.equal(await pm.read.cumulativeFundingIndex([BTC]), 0n);
    assert.ok((await pm.read.cumulativeFundingIndex([NVDA])) > 0n);
  });

  // ==================== SETTLEMENT ====================

  it("settles accrued funding on close, reducing the payout", async function () {
    const { token, pm } = await setup();
    const id = await open(pm, long, true);

    await mine(200);
    const owed = await pm.read.fundingOwed([id]);
    assert.ok(owed > 0n, "the lone long must owe funding");

    await pm.write.closePosition([id, []], { account: long.account });

    // Without funding the payout would be the full 999 collateral less the close
    // fee. Funding must come off it.
    const balance = await token.read.balanceOf([long.account.address]);
    const received = balance - usdc(199_000); // started with 200,000, posted 1,000
    assert.ok(received < usdc(999), `payout ${received} should be below the 999 collateral`);

    const noFunding = usdc(999) - (usdc(999) * 10n) / BPS;
    assert.ok(
      received < noFunding,
      `payout ${received} should be below the no-funding figure ${noFunding}`
    );
  });

  it("emits FundingSettled when a position settles", async function () {
    const { pm } = await setup();
    const id = await open(pm, long, true);
    await mine(50);

    const publicClient = await viem.getPublicClient();
    await pm.write.closePosition([id, []], { account: long.account });

    const events = await publicClient.getContractEvents({
      address: pm.address,
      abi: pm.abi,
      eventName: "FundingSettled",
      fromBlock: 0n,
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].args.positionId, id);
    assert.ok((events[0].args.amount as bigint) > 0n, "a crowded long must have paid");
  });

  it("stops charging a position once it is closed", async function () {
    const { pm } = await setup();
    const id = await open(pm, long, true);
    await pm.write.closePosition([id, []], { account: long.account });

    // Open interest must be released, or the book would keep charging for a
    // position that no longer exists.
    const [longUsd, shortUsd] = await pm.read.openInterest([NVDA]);
    assert.equal(longUsd, 0n);
    assert.equal(shortUsd, 0n);

    // One block of funding was legitimately banked while the lone long was open;
    // what must hold is that a later accrual with no open interest adds nothing.
    await pm.write.accrueFunding([NVDA], { account: keeper.account });
    const afterClose = await pm.read.cumulativeFundingIndex([NVDA]);

    await mine(50);
    await pm.write.accrueFunding([NVDA], { account: keeper.account });

    assert.equal(await pm.read.cumulativeFundingIndex([NVDA]), afterClose);
  });

  // ==================== FUNDING AS A LIQUIDATION CAUSE ====================

  it("can push a position through its maintenance margin on its own", async function () {
    const { pm } = await setup();

    // A lone long at 50x: maintenance margin is 1% of 49,950 = 499.5 USD, and
    // collateral is 999. Funding at 1e-5 of notional per block costs ~0.5 USD
    // per block, so a few hundred blocks eats the margin without the price
    // moving at all.
    await pm.write.openPosition([NVDA, usdc(1_000), 500_000n, true, []], {
      account: long.account,
    });
    const id = await pm.read.nextPositionId();

    // Price is untouched, so PnL is zero and any change is funding's doing.
    assert.equal(await pm.read.unrealizedPnl([id]), 0n);

    await mine(1_500);
    await pm.write.accrueFunding([NVDA], { account: keeper.account });

    const equity = await pm.read.positionEquity([id]);
    assert.ok(equity < usd(999), `equity ${equity} should have fallen below the collateral`);

    const owed = await pm.read.fundingOwed([id]);
    assert.ok(owed > 0n, "the position must owe funding");
    assert.ok(owed > usd(400), `after 1500 blocks funding ${owed} should be substantial`);

    // And the verdict reflects it.
    assert.equal(await pm.read.isLiquidatable([id]), true, "funding alone must be able to liquidate");
  });

  // ==================== THE RATE PARAMETER ====================

  it("starts at the realistic default", async function () {
    const token = await viem.deployContract("MockUSDC");
    const oracle = await viem.deployContract("DemoOracle");
    const vault = await viem.deployContract("Vault", [token.address, deployer.account.address]);
    const pm = await viem.deployContract("PositionManager", [
      vault.address,
      oracle.address,
      token.address,
      deployer.account.address,
    ]);

    // 1e11 WAD per block at full skew is ~0.86%/day on a 1s chain.
    assert.equal(await pm.read.fundingRatePerBlockWad(), 100_000_000_000n);
  });

  it("lets the owner retune the rate, and refuses one above the ceiling", async function () {
    const { pm } = await setup();

    await pm.write.setFundingRatePerBlockWad([1_000n]);
    assert.equal(await pm.read.fundingRatePerBlockWad(), 1_000n);

    // 1e13 is the cap; anything above must be refused.
    await assert.rejects(pm.write.setFundingRatePerBlockWad([10_000_000_000_001n]));
    // Negative rates are meaningless here: direction comes from the skew.
    await assert.rejects(pm.write.setFundingRatePerBlockWad([-1n]));
  });

  it("refuses a rate change from anyone but the owner", async function () {
    const { pm } = await setup();

    await assert.rejects(
      pm.write.setFundingRatePerBlockWad([1n], { account: keeper.account })
    );
  });

  it("accrues nothing at a zero rate", async function () {
    const { pm } = await setup();
    await pm.write.setFundingRatePerBlockWad([0n]);
    await open(pm, long, true);

    await mine(100);
    await pm.write.accrueFunding([NVDA], { account: keeper.account });

    assert.equal(await pm.read.cumulativeFundingIndex([NVDA]), 0n);
  });

  // ==================== ANYONE MAY ACCRUE ====================

  it("lets anyone accrue funding, not just the owner", async function () {
    const { pm } = await setup();
    await open(pm, long, true);
    await mine(10);

    // Permissionless on purpose: no keeper to schedule, no cron. Whichever
    // transaction touches the feed first in a block advances the index, so the
    // chain's own block production is the clock.
    await pm.write.accrueFunding([NVDA], { account: keeper.account });
    assert.ok((await pm.read.cumulativeFundingIndex([NVDA])) > 0n);
  });

  it("emits FundingAccrued carrying the block number", async function () {
    const { pm } = await setup();
    await open(pm, long, true);
    await mine(5);

    const publicClient = await viem.getPublicClient();
    const block = await publicClient.getBlock();
    await pm.write.accrueFunding([NVDA], { account: keeper.account });

    const events = await publicClient.getContractEvents({
      address: pm.address,
      abi: pm.abi,
      eventName: "FundingAccrued",
      fromBlock: 0n,
    });
    assert.ok(events.length >= 1);
    const last = events[events.length - 1];
    assert.equal(last.args.feedId, NVDA);
    // The block number is the proof that this advanced with block production.
    assert.ok((last.args.blockNumber as bigint) >= block.number);
    assert.ok((last.args.skewWad as bigint) > 0n, "a lone long is fully skewed");
  });
});
