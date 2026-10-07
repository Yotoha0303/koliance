import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

/**
 * Integration tests: MockUSDC + DemoOracle + Vault + PositionManager wired
 * together the way the deployment will be.
 *
 * Wiring order matters and is asserted below — PositionManager settles fees and
 * payouts through the Vault, so `vault.setPositionManager(pm)` must happen before
 * any position can open.
 */

const E18 = 10n ** 18n;
const E6 = 10n ** 6n;
const usd = (n: bigint | number) => BigInt(n) * E18;
const usdc = (n: bigint | number) => BigInt(n) * E6;

const NVDA = "0xa470c4ac46f44b547b2cba52338f311fb642b79375ce5f0cfd5cb5b99227b852" as const;
const BTC = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" as const;

const BPS = 10_000n;
const OPEN_FEE_BPS = 10n;
const CLOSE_FEE_BPS = 10n;
const MMR_BPS = 100n;
const LIQ_REWARD_BPS = 500n;

const PRICE_180 = usd(180);

/**
 * Mirrors PositionManager._isLiquidatable so tests can compute the exact price at
 * which a verdict flips. Kept in the same operation order as the contract — two
 * integer divisions, in that order — or the boundary tests become meaningless.
 */
function computeLiquidationPrice(
  collateralUsd: bigint,
  entryPrice: bigint,
  leverageBps: bigint,
  isLong: boolean
): bigint {
  const size = (collateralUsd * leverageBps) / BPS;
  const mm = (size * MMR_BPS) / BPS;
  if (isLong) {
    const num = mm - collateralUsd + size;
    return (entryPrice * num) / size;
  }
  const num = collateralUsd + size - mm;
  return (entryPrice * num) / size;
}

function pnlOf(
  collateralUsd: bigint,
  entryPrice: bigint,
  leverageBps: bigint,
  isLong: boolean,
  exitPrice: bigint
): bigint {
  const size = (collateralUsd * leverageBps) / BPS;
  const delta = isLong ? exitPrice - entryPrice : entryPrice - exitPrice;
  return (size * delta) / entryPrice;
}

describe("PositionManager", async function () {
  const { viem } = await network.getOrCreate();
  const [deployer, lp, trader, otherTrader, liquidator] = await viem.getWalletClients();

  /** Full deployment, wired the way production will be. */
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

    // PositionManager settles through the Vault, so the wiring has to precede use.
    await vault.write.setPositionManager([pm.address]);

    await oracle.write.setPrice([NVDA, PRICE_180]);
    await oracle.write.setPrice([BTC, usd(65_000)]);

    // Seed LP liquidity.
    await token.write.mint([lp.account.address, usdc(100_000)]);
    await token.write.approve([vault.address, usdc(100_000)], { account: lp.account });
    await vault.write.addLiquidity([usdc(100_000)], { account: lp.account });

    // Fund traders and approve the PositionManager (it is the spender, not the Vault).
    for (const who of [trader, otherTrader, liquidator]) {
      await token.write.mint([who.account.address, usdc(10_000)]);
      await token.write.approve([pm.address, usdc(10_000)], { account: who.account });
    }

    return { token, oracle, vault, pm };
  }

  /** Open a position and return its id. */
  async function open(
    pm: any,
    who: any,
    opts: { feedId?: `0x${string}`; collateral?: bigint; leverageBps?: bigint; isLong?: boolean } = {}
  ) {
    const {
      feedId = NVDA,
      collateral = usdc(1_000),
      leverageBps = 100_000n,
      isLong = true,
    } = opts;
    await pm.write.openPosition([feedId, collateral, leverageBps, isLong, []], {
      account: who.account,
    });
    return await pm.read.nextPositionId();
  }

  // ==================== OPEN ====================

  it("Opens a position, routes collateral to the Vault, and takes the open fee", async function () {
    const { token, vault, pm } = await setup();

    const id = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });

    // 1000 USDC in, 0.1% fee = 1 USD, so 999 USD of collateral.
    const p = await pm.read.getPosition([id]);
    assert.equal(p.collateralUsd, usd(999));
    assert.equal(p.sizeUsd, usd(9_990)); // 999 * 10x
    assert.equal(p.entryPrice, PRICE_180);
    assert.equal(p.isLong, true);
    assert.equal((p.owner as string).toLowerCase(), trader.account.address.toLowerCase());

    // Collateral sits in the Vault, not the PositionManager.
    assert.equal(await token.read.balanceOf([vault.address]), usdc(101_000));
    assert.equal(await token.read.balanceOf([pm.address]), 0n);
  });

  it("Records the open fee against the Vault", async function () {
    const { vault, pm } = await setup();

    await open(pm, trader, { collateral: usdc(1_000) });

    assert.equal(await vault.read.accumulatedFees(), usd(1));
  });

  it("Computes size from collateral after the fee, not before", async function () {
    const { pm } = await setup();

    const id = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });

    // size = (1000 - 1) * 10 = 9990, NOT 1000 * 10 = 10000.
    assert.equal((await pm.read.getPosition([id])).sizeUsd, usd(9_990));
  });

  it("Accepts 1x and 50x", async function () {
    const { pm } = await setup();

    await open(pm, trader, { collateral: usdc(100), leverageBps: 10_000n });
    await open(pm, trader, { collateral: usdc(100), leverageBps: 500_000n });

    assert.equal(await pm.read.nextPositionId(), 2n);
  });

  it("Rejects leverage above 50x", async function () {
    const { pm } = await setup();

    await assert.rejects(
      pm.write.openPosition([NVDA, usdc(100), 500_001n, true, []], { account: trader.account })
    );
  });

  it("Rejects leverage below 1x", async function () {
    const { pm } = await setup();

    await assert.rejects(
      pm.write.openPosition([NVDA, usdc(100), 9_999n, true, []], { account: trader.account })
    );
  });

  it("Rejects a zero-collateral position", async function () {
    const { pm } = await setup();

    await assert.rejects(
      pm.write.openPosition([NVDA, 0n, 100_000n, true, []], { account: trader.account })
    );
  });

  it("Ids start at 1, so 0 is never a valid position", async function () {
    const { pm } = await setup();

    const id = await open(pm, trader);

    assert.equal(id, 1n);
    // getPosition does not revert on an unknown id — Solidity returns the zero
    // struct. isOpen is the field that actually distinguishes a real position.
    assert.equal(await pm.read.isOpen([0n]), false);
    assert.equal(
      (await pm.read.getPosition([0n])).owner,
      "0x0000000000000000000000000000000000000000"
    );
  });

  it("Emits PositionOpened with the post-fee collateral", async function () {
    const { pm } = await setup();
    const publicClient = await viem.getPublicClient();

    await pm.write.openPosition([NVDA, usdc(1_000), 100_000n, true, []], {
      account: trader.account,
    });

    const events = await publicClient.getContractEvents({
      address: pm.address,
      abi: pm.abi,
      eventName: "PositionOpened",
      fromBlock: 0n,
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].args.collateralUsd, usd(999));
    assert.equal(events[0].args.sizeUsd, usd(9_990));
    assert.equal(events[0].args.isLong, true);
  });

  // ==================== RESERVED ASSETS ====================
  //
  // The reserve is the sum of each position's PAYOUT CAP, not the sum of open
  // collateral. Collateral is only a lower bound on what the pool may owe: it is
  // exact for a losing position and short for a winning one, and the shortfall is
  // what let an LP drain a pool out from under a profitable trader. See ADR-002.

  it("Reports the sum of payout caps as reserved assets", async function () {
    const { pm } = await setup();

    await open(pm, trader, { collateral: usdc(1_000) });
    await open(pm, trader, { collateral: usdc(500) });

    // Each cap is `collateral + size * MAX_PROFIT_BPS / BPS`. With 10x leverage
    // that is `collateral + 10 * collateral` = 11x, courtesy of the default
    // `open()` leverage of 100_000.
    //   position 1: 999   + 9990   = 10,989
    //   position 2: 499.5 + 4995   = 5,494.5
    const halfUsd = (5n * E18) / 10n;
    const cap1 = usd(999) + usd(9_990);
    const cap2 = usd(499) + halfUsd + usd(4_995);

    assert.equal(await pm.read.reservedAssets(), cap1 + cap2);
  });

  it("Caps a high-leverage position at a larger reserve than a low-leverage one", async function () {
    const { pm } = await setup();

    await open(pm, trader, { collateral: usdc(1_000), leverageBps: 10_000n }); // 1x
    const oneX = await pm.read.reservedAssets();

    await open(pm, trader, { collateral: usdc(1_000), leverageBps: 500_000n }); // 50x
    const fiftyX = (await pm.read.reservedAssets()) - oneX;

    // cap = collateral + size, since MAX_PROFIT_BPS is 10_000 (100% of notional).
    //   1x : 999 +    999 =  1,998
    //   50x: 999 + 49,950 = 50,949
    // A 50x position can be owed 50x its notional in profit, so it consumes ~25x
    // the pool capacity of a 1x one. That is the price of capping instead of
    // reverting: bigger limits need a bigger pool behind them.
    assert.equal(oneX, usd(999) + usd(999));
    assert.equal(fiftyX, usd(999) + usd(49_950));
  });

  it("Releases the reserve when a position closes", async function () {
    const { pm } = await setup();
    const id = await open(pm, trader, { collateral: usdc(1_000) });

    await pm.write.closePosition([id, 0n, 0n, []], { account: trader.account });

    assert.equal(await pm.read.reservedAssets(), 0n);
  });

  it("Stops LPs from withdrawing collateral backing an open position", async function () {
    const { vault, pm } = await setup();

    await open(pm, trader, { collateral: usdc(1_000) });

    // Pool holds 101,000 USDC. The position's payout cap is 999 + 9,990 = 10,989,
    // so the reserve is that (not the 999 of principal it used to be) and only
    // 100,001 − (10,989 − 999) is withdrawable.
    const cap = usd(999) + usd(9_990);
    assert.equal(await vault.read.reservedAssets(), cap);
    assert.equal(await vault.read.availableAssets(), usd(101_000) - cap);

    // Redeeming the LP's entire claim would return 101,000 USD, far above what is
    // available — must revert.
    await assert.rejects(
      vault.write.removeLiquidity([usd(100_000)], { account: lp.account })
    );

    // Within the limit it goes through. `grossUsd` is the pro-rata share of the
    // pool, so burning 85,000 of 100,000 shares against 101,000 of assets takes
    // 85,850 — inside the 90,011 that is available.
    await vault.write.removeLiquidity([usd(85_000)], { account: lp.account });
    assert.equal(await vault.read.reservedAssets(), cap);
  });

  // ==================== CLOSE ====================
  //
  // These two assert the payout arithmetic, so funding must be neutral: a lone
  // long is a 100%-skewed book and accrues funding the moment it opens, which
  // would subtract from the expected payout. An equal-sized short from a
  // different account flattens the skew to zero without touching the trader's
  // balance. Funding itself is covered in test/perp/Funding.ts.

  /** Open a long and an offsetting short so the feed's skew is exactly zero. */
  async function hedgeFeed(pm: any, trader: any, other: any) {
    await open(pm, other, { collateral: usdc(1_000), leverageBps: 100_000n, isLong: false });
    return await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });
  }

  it("Pays a winning long out of the pool", async function () {
    const { token, oracle, pm } = await setup();
    const id = await hedgeFeed(pm, trader, otherTrader);

    // 180 -> 200 is +11.1% on 9990 notional = +1110 USD.
    await oracle.write.setPrice([NVDA, usd(200)]);
    await pm.write.closePosition([id, 0n, 0n, []], { account: trader.account });

    const expectedPnl = pnlOf(usd(999), PRICE_180, 100_000n, true, usd(200));
    const equity = usd(999) + expectedPnl;
    const afterFee = equity - (equity * CLOSE_FEE_BPS) / BPS;

    // Started with 10,000, posted 1,000 as collateral, receives the payout back.
    assert.equal(
      await token.read.balanceOf([trader.account.address]),
      usdc(9_000) + afterFee / 10n ** 12n
    );
    assert.equal(await pm.read.isOpen([id]), false);
  });

  it("Leaves a losing long's remainder in the pool", async function () {
    const { token, oracle, vault, pm } = await setup();
    const id = await hedgeFeed(pm, trader, otherTrader);
    const poolBefore = await vault.read.totalAssets();

    // 180 -> 170 is -5.55% on 9990 notional = -555 USD.
    await oracle.write.setPrice([NVDA, usd(170)]);
    await pm.write.closePosition([id, 0n, 0n, []], { account: trader.account });

    const pnl = pnlOf(usd(999), PRICE_180, 100_000n, true, usd(170));
    const equity = usd(999) + pnl; // pnl is negative
    const afterFee = equity - (equity * CLOSE_FEE_BPS) / BPS;
    const paidOut = afterFee / (10n ** 12n);

    assert.equal(await token.read.balanceOf([trader.account.address]), usdc(9_000) + paidOut);
    // The pool kept the loss.
    assert.ok((await vault.read.totalAssets()) > poolBefore - usd(1_000));
  });

  it("Caps a catastrophic loss at the posted collateral, never below zero", async function () {
    const { token, oracle, pm } = await setup();
    const id = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 500_000n });

    // 50x long, price halves — the position is far past liquidation. Closing must
    // still succeed and simply pay nothing, not underflow.
    await oracle.write.setPrice([NVDA, usd(90)]);
    await pm.write.closePosition([id, 0n, 0n, []], { account: trader.account });

    assert.equal(await token.read.balanceOf([trader.account.address]), usdc(9_000));
  });

  it("Refuses to close someone else's position", async function () {
    const { pm } = await setup();
    const id = await open(pm, trader);

    await assert.rejects(
      pm.write.closePosition([id, 0n, 0n, []], { account: otherTrader.account })
    );
  });

  it("Refuses to close the same position twice", async function () {
    const { pm } = await setup();
    const id = await open(pm, trader);

    await pm.write.closePosition([id, 0n, 0n, []], { account: trader.account });

    await assert.rejects(
      pm.write.closePosition([id, 0n, 0n, []], { account: trader.account })
    );
  });

  // ==================== EXIT PROTECTION (GAP-07) ====================
  //
  // The exit price is whatever the oracle reports when the transaction lands. On
  // a public mempool that means a close can be held and included against a worse
  // print than the one the trader simulated, and on the Pyth path the price comes
  // from caller-supplied update data outright. These two parameters are the
  // caller's defence; without them a close is a blind market order.

  it("Refuses a close whose payout falls below minOut", async function () {
    const { oracle, pm } = await setup();
    const id = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });

    // +11.1%: equity ≈ 999 + 1110 = 2109, less the 0.1% close fee.
    await oracle.write.setPrice([NVDA, usd(200)]);
    const equity = usd(999) + pnlOf(usd(999), PRICE_180, 100_000n, true, usd(200));
    const afterFee = equity - (equity * CLOSE_FEE_BPS) / BPS;

    await assert.rejects(
      pm.write.closePosition([id, afterFee + usd(1), 0n, []], { account: trader.account }),
      "a payout below the caller's floor must revert"
    );

    // The position must be untouched: both checks run before any state change,
    // so a rejected close leaves it open rather than half-settled.
    assert.equal(await pm.read.isOpen([id]), true);
  });

  it("Allows a close whose payout meets minOut", async function () {
    const { oracle, pm } = await setup();
    // Hedge the feed first so funding is zero and the payout is exactly the
    // PnL-derived figure. Without this the boundary is off by a few wei of
    // accrued funding and the test would be asserting the wrong arithmetic.
    await open(pm, otherTrader, { collateral: usdc(1_000), leverageBps: 100_000n, isLong: false });
    const id = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });

    await oracle.write.setPrice([NVDA, usd(200)]);
    const equity = usd(999) + pnlOf(usd(999), PRICE_180, 100_000n, true, usd(200));
    const afterFee = equity - (equity * CLOSE_FEE_BPS) / BPS;

    // Exactly at the floor is acceptable — the guard is `<`, not `<=`.
    await pm.write.closePosition([id, afterFee, 0n, []], { account: trader.account });
    assert.equal(await pm.read.isOpen([id]), false);
  });

  it("Refuses a close one wei below the floor", async function () {
    const { oracle, pm } = await setup();
    await open(pm, otherTrader, { collateral: usdc(1_000), leverageBps: 100_000n, isLong: false });
    const id = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });

    await oracle.write.setPrice([NVDA, usd(200)]);
    const equity = usd(999) + pnlOf(usd(999), PRICE_180, 100_000n, true, usd(200));
    const afterFee = equity - (equity * CLOSE_FEE_BPS) / BPS;

    // One wei tighter must revert. This is the case that pins the comparison
    // down: without it, `<` and `<=` would both pass the test above.
    await assert.rejects(
      pm.write.closePosition([id, afterFee + 1n, 0n, []], { account: trader.account })
    );
    assert.equal(await pm.read.isOpen([id]), true);
  });

  it("Treats a minOut of zero as no protection", async function () {
    const { pm } = await setup();
    const id = await open(pm, trader);
    await pm.write.closePosition([id, 0n, 0n, []], { account: trader.account });
    assert.equal(await pm.read.isOpen([id]), false);
  });

  it("Refuses a close past its deadline", async function () {
    const { pm } = await setup();
    const id = await open(pm, trader);
    const publicClient = await viem.getPublicClient();
    const now = await publicClient.getBlock().then((b) => b.timestamp);

    await assert.rejects(
      pm.write.closePosition([id, 0n, now - 1n, []], { account: trader.account }),
      "a close after its deadline must revert"
    );
    assert.equal(await pm.read.isOpen([id]), true);
  });

  it("Treats a deadline of zero as no deadline", async function () {
    const { pm } = await setup();
    const id = await open(pm, trader);
    await pm.write.closePosition([id, 0n, 0n, []], { account: trader.account });
    assert.equal(await pm.read.isOpen([id]), false);
  });

  it("Accepts a close well inside its deadline", async function () {
    const { pm } = await setup();
    const id = await open(pm, trader);
    const publicClient = await viem.getPublicClient();
    const now = await publicClient.getBlock().then((b) => b.timestamp);

    await pm.write.closePosition([id, 0n, now + 3_600n, []], { account: trader.account });
    assert.equal(await pm.read.isOpen([id]), false);
  });

  // ==================== LIQUIDATION THRESHOLD ====================
  //
  // These two land exactly on the PnL-derived threshold, so they need funding
  // to be neutral. With a single long the book is 100% skewed and funding
  // accrues immediately, which would shift the verdict by a few wei and make the
  // ±1 assertions test the wrong thing. Opening an equal-sized short first
  // flattens the skew to zero, so the threshold is purely `collateral + pnl`.
  //
  // Funding itself is covered in test/perp/Funding.ts.

  it("Is liquidatable exactly at the computed liquidation price", async function () {
    const { oracle, pm } = await setup();
    await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n, isLong: false });
    const id = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });

    const liq = computeLiquidationPrice(usd(999), PRICE_180, 100_000n, true);
    await oracle.write.setPrice([NVDA, liq]);

    assert.equal(await pm.read.isLiquidatable([id]), true);
  });

  it("Is not liquidatable one wei above the liquidation price", async function () {
    const { oracle, pm } = await setup();
    await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n, isLong: false });
    const id = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });

    const liq = computeLiquidationPrice(usd(999), PRICE_180, 100_000n, true);
    await oracle.write.setPrice([NVDA, liq + 1n]);

    assert.equal(await pm.read.isLiquidatable([id]), false);
  });

  it("Puts the liquidation price for a 10x long above the floor", async function () {
    const { pm } = await setup();
    await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });

    const liq = computeLiquidationPrice(usd(999), PRICE_180, 100_000n, true);
    // ~163.80 by hand: 180 * (99.9 - 999 + 9990) / 9990
    assert.ok(liq > usd(163) && liq < usd(164));
  });

  it("Puts the liquidation price for a short above the entry", async function () {
    const { pm } = await setup();
    await open(pm, trader, { leverageBps: 100_000n, isLong: false });

    const liq = computeLiquidationPrice(usd(999), PRICE_180, 100_000n, false);
    assert.ok(liq > PRICE_180);
  });

  // ==================== LIQUIDATION ====================

  it("Liquidates a position past its threshold and pays the caller", async function () {
    const { token, oracle, pm } = await setup();
    const id = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });

    const liq = computeLiquidationPrice(usd(999), PRICE_180, 100_000n, true);
    await oracle.write.setPrice([NVDA, liq - usd(1)]);

    const before = await token.read.balanceOf([liquidator.account.address]);
    await pm.write.liquidate([[id], []], { account: liquidator.account });
    const after = await token.read.balanceOf([liquidator.account.address]);

    assert.ok(after > before, "liquidator should be paid a bounty");
    assert.equal(await pm.read.isOpen([id]), false);
    assert.equal(await pm.read.reservedAssets(), 0n);
  });

  it("Rewards the liquidator the configured share of the position's collateral", async function () {
    const { token, oracle, pm } = await setup();
    const id = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });

    const liq = computeLiquidationPrice(usd(999), PRICE_180, 100_000n, true);
    const crash = liq - usd(1);
    await oracle.write.setPrice([NVDA, crash]);

    // The base is COLLATERAL, not remaining equity. Paying a share of equity made
    // the bounty shrink toward zero exactly as a position approached bankruptcy —
    // the case where a liquidator is most needed. See ADR-002 and GAP-05.
    const expected = (usd(999) * LIQ_REWARD_BPS) / BPS / 10n ** 12n;

    const before = await token.read.balanceOf([liquidator.account.address]);
    await pm.write.liquidate([[id], []], { account: liquidator.account });
    const gained = (await token.read.balanceOf([liquidator.account.address])) - before;

    // Allow a 1-unit tolerance for the truncation chain (USD -> USDC).
    const diff = gained > expected ? gained - expected : expected - gained;
    assert.ok(diff <= 1n, `reward ${gained} should be within 1 of ${expected}`);
  });

  it("Refuses to liquidate a healthy position", async function () {
    const { pm } = await setup();
    // A matching short flattens the skew so funding does not nibble the margin
    // between open and liquidate — otherwise this becomes a test of funding
    // rather than of the healthy-position path.
    await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n, isLong: false });
    const id = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });

    // Price is still 180, far from the ~163.8 threshold. The batch silently skips
    // rather than reverting, so assert on the resulting state.
    await pm.write.liquidate([[id], []], { account: liquidator.account });

    assert.equal(await pm.read.isOpen([id]), true);
  });

  // ==================== BATCH LIQUIDATION ====================

  it("Liquidates only the eligible positions in a mixed batch", async function () {
    const { oracle, pm } = await setup();

    // Two longs, one short — a price drop kills the longs and spares the short.
    const long1 = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n, isLong: true });
    const long2 = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n, isLong: true });
    const short1 = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n, isLong: false });

    const liq = computeLiquidationPrice(usd(999), PRICE_180, 100_000n, true);
    await oracle.write.setPrice([NVDA, liq - usd(1)]);

    await pm.write.liquidate([[long1, long2, short1], []], { account: liquidator.account });

    assert.equal(await pm.read.isOpen([long1]), false);
    assert.equal(await pm.read.isOpen([long2]), false);
    assert.equal(await pm.read.isOpen([short1]), true, "short profits from a drop");
  });

  it("Reaches the same verdicts regardless of order within the batch", async function () {
    const { oracle, pm } = await setup();

    const a = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n, isLong: true });
    const b = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n, isLong: true });

    const liq = computeLiquidationPrice(usd(999), PRICE_180, 100_000n, true);
    await oracle.write.setPrice([NVDA, liq - usd(1)]);

    // Reversed order — the snapshot is taken before any state changes, so the
    // second position is judged against the same price as the first.
    await pm.write.liquidate([[b, a], []], { account: liquidator.account });

    assert.equal(await pm.read.isOpen([a]), false);
    assert.equal(await pm.read.isOpen([b]), false);
  });

  it("Ignores unknown ids in a batch instead of reverting", async function () {
    const { oracle, pm } = await setup();
    const id = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });

    const liq = computeLiquidationPrice(usd(999), PRICE_180, 100_000n, true);
    await oracle.write.setPrice([NVDA, liq - usd(1)]);

    await pm.write.liquidate([[999n, id, 998n], []], { account: liquidator.account });

    assert.equal(await pm.read.isOpen([id]), false);
  });

  it("Handles an empty batch as a no-op", async function () {
    const { pm } = await setup();

    await pm.write.liquidate([[], []], { account: liquidator.account });
  });

  it("Liquidates across two feeds in one call", async function () {
    const { oracle, pm } = await setup();

    const nvda = await open(pm, trader, { feedId: NVDA, collateral: usdc(1_000), leverageBps: 100_000n });
    const btc = await open(pm, trader, { feedId: BTC, collateral: usdc(1_000), leverageBps: 100_000n });

    const liqNvda = computeLiquidationPrice(usd(999), PRICE_180, 100_000n, true);
    await oracle.write.setPrice([NVDA, liqNvda - usd(1)]);
    // BTC halving region, well past a 10x long's threshold.
    await oracle.write.setPrice([BTC, usd(50_000)]);

    await pm.write.liquidate([[nvda, btc], []], { account: liquidator.account });

    assert.equal(await pm.read.isOpen([nvda]), false);
    assert.equal(await pm.read.isOpen([btc]), false);
  });

  // ==================== PARAMETER GETTERS ====================

  it("Exposes the deployed parameters to off-chain consumers", async function () {
    const { pm } = await setup();

    assert.equal(await pm.read.openFeeBps(), OPEN_FEE_BPS);
    assert.equal(await pm.read.closeFeeBps(), CLOSE_FEE_BPS);
    assert.equal(await pm.read.maintenanceMarginBps(), MMR_BPS);
    assert.equal(await pm.read.liquidatorRewardBps(), LIQ_REWARD_BPS);
    assert.equal(await pm.read.maxLeverageBps(), 500_000n);
  });

  // ==================== PRICE UPDATER ====================

  it("Accepts empty update data when no price updater is wired", async function () {
    const { pm } = await setup();

    // DemoOracle needs no push; the frozen `bytes[]` argument must still be tolerated.
    assert.equal(await pm.read.priceUpdater(), "0x0000000000000000000000000000000000000000");
    await open(pm, trader);
  });

  it("Only the owner may set the price updater", async function () {
    const { pm } = await setup();

    await assert.rejects(
      pm.write.setPriceUpdater([otherTrader.account.address], { account: otherTrader.account })
    );
    await pm.write.setPriceUpdater([otherTrader.account.address]);
    assert.equal(
      (await pm.read.priceUpdater()).toLowerCase(),
      otherTrader.account.address.toLowerCase()
    );
  });

  it("Does not block a close when the price updater is not a contract", async function () {
    const { pm } = await setup();
    const id = await open(pm, trader);
    const publicClient = await viem.getPublicClient();

    // An EOA: no code at the address. A typed call to it reverts with "function
    // call to a non-contract account", and that revert is NOT caught by a
    // try/catch — the code-existence check happens before the call. Without the
    // `code.length` guard in _pushPrices, a misconfigured updater would brick
    // every close, which is GAP-01 arriving by a new route.
    await pm.write.setPriceUpdater([otherTrader.account.address]);

    await pm.write.closePosition([id, 0n, 0n, ["0xdeadbeef"]], { account: trader.account });
    assert.equal(await pm.read.isOpen([id]), false, "a bad updater must not brick a close");

    // And the failure must be visible on chain rather than silent. This is the
    // half that did not exist before: the old low-level call swallowed the
    // result with no event, so a dead updater looked identical to a working one.
    const failed = await publicClient.getContractEvents({
      address: pm.address,
      abi: pm.abi,
      eventName: "PricePushFailed",
      fromBlock: 0n,
    });
    assert.equal(failed.length, 1, "a skipped push must emit PricePushFailed");
    assert.equal(
      (failed[0].args.updater as string).toLowerCase(),
      otherTrader.account.address.toLowerCase()
    );
    assert.equal(failed[0].args.updateCount, 1n);
  });

  it("Emits PricePushSucceeded when a push reaches the updater", async function () {
    const token = await viem.deployContract("MockUSDC");
    const pyth = await viem.deployContract("MockPyth");
    const adapter = await viem.deployContract("PythOracleAdapter", [
      pyth.address,
      60n,
      deployer.account.address,
    ]);
    const vault = await viem.deployContract("Vault", [token.address, deployer.account.address]);
    const pm = await viem.deployContract("PositionManager", [
      vault.address,
      adapter.address,
      token.address,
      deployer.account.address,
    ]);
    await vault.write.setPositionManager([pm.address]);
    await pm.write.setPriceUpdater([adapter.address]);
    await pyth.write.setUpdateFee([0n]);

    const publicClient = await viem.getPublicClient();
    const now = await publicClient.getBlock().then((b) => b.timestamp);
    await pyth.write.setPrice([BTC, 18_000_000_000n, -8, now, 0n]);

    await token.write.mint([lp.account.address, usdc(10_000)]);
    await token.write.approve([vault.address, usdc(10_000)], { account: lp.account });
    await vault.write.addLiquidity([usdc(10_000)], { account: lp.account });

    await token.write.mint([trader.account.address, usdc(1_000)]);
    await token.write.approve([pm.address, usdc(1_000)], { account: trader.account });

    await pm.write.openPosition([BTC, usdc(1_000), 100_000n, true, ["0xdeadbeef"]], {
      account: trader.account,
    });

    // Positive evidence that the oracle's staleness window is being refreshed,
    // which the old design could not show at all.
    const ok = await publicClient.getContractEvents({
      address: pm.address,
      abi: pm.abi,
      eventName: "PricePushSucceeded",
      fromBlock: 0n,
    });
    assert.equal(ok.length, 1);
    assert.equal((ok[0].args.updater as string).toLowerCase(), adapter.address.toLowerCase());
  });

  // ==================== PYTH ADAPTER INTEGRATION ====================
  // The one place the two halves of the oracle story meet: PositionManager driving
  // PythOracleAdapter as both price source and price pusher. Everything else uses
  // DemoOracle, so a wiring mistake would otherwise only surface in production.

  it("Trades against a PythOracleAdapter and pushes updates before reading", async function () {
    const token = await viem.deployContract("MockUSDC");
    const pyth = await viem.deployContract("MockPyth");
    const adapter = await viem.deployContract("PythOracleAdapter", [
      pyth.address,
      60n,
      deployer.account.address,
    ]);
    const vault = await viem.deployContract("Vault", [token.address, deployer.account.address]);
    const pm = await viem.deployContract("PositionManager", [
      vault.address,
      adapter.address,
      token.address,
      deployer.account.address,
    ]);
    await vault.write.setPositionManager([pm.address]);

    // Wire the adapter as the pusher. PositionManager reaches it through
    // abi.encodeWithSignature("updatePriceFeeds(bytes[])", data) — if that
    // signature drifted from the adapter's, the call would silently miss and
    // updateCallCount would stay zero.
    await pm.write.setPriceUpdater([adapter.address]);
    await pyth.write.setUpdateFee([0n]);

    const publicClient = await viem.getPublicClient();
    const now = await publicClient.getBlock().then((b) => b.timestamp);
    // expo -8, i.e. $180.00
    await pyth.write.setPrice([BTC, 18_000_000_000n, -8, now, 0n]);

    await token.write.mint([lp.account.address, usdc(10_000)]);
    await token.write.approve([vault.address, usdc(10_000)], { account: lp.account });
    await vault.write.addLiquidity([usdc(10_000)], { account: lp.account });

    await token.write.mint([trader.account.address, usdc(1_000)]);
    await token.write.approve([pm.address, usdc(1_000)], { account: trader.account });

    await pm.write.openPosition([BTC, usdc(1_000), 100_000n, true, ["0xdeadbeef"]], {
      account: trader.account,
    });

    // The push actually reached Pyth.
    assert.equal(await pyth.read.updateCallCount(), 1n);

    // And the entry price came through the adapter's normalization: $180 at
    // expo -8 is 18e18, not 18e15.
    const position = await pm.read.getPosition([1n]);
    assert.equal(position.entryPrice, usd(180));
  });

  it("Survives a push the adapter cannot fund, and still opens at the last price", async function () {
    const token = await viem.deployContract("MockUSDC");
    const pyth = await viem.deployContract("MockPyth");
    const adapter = await viem.deployContract("PythOracleAdapter", [
      pyth.address,
      60n,
      deployer.account.address,
    ]);
    const vault = await viem.deployContract("Vault", [token.address, deployer.account.address]);
    const pm = await viem.deployContract("PositionManager", [
      vault.address,
      adapter.address,
      token.address,
      deployer.account.address,
    ]);
    await vault.write.setPositionManager([pm.address]);
    await pm.write.setPriceUpdater([adapter.address]);

    // Fee is non-zero and the adapter holds no MON, so every push reverts.
    await pyth.write.setUpdateFee([1_000_000n]);

    const publicClient = await viem.getPublicClient();
    const now = await publicClient.getBlock().then((b) => b.timestamp);
    await pyth.write.setPrice([BTC, 18_000_000_000n, -8, now, 0n]);

    await token.write.mint([lp.account.address, usdc(10_000)]);
    await token.write.approve([vault.address, usdc(10_000)], { account: lp.account });
    await vault.write.addLiquidity([usdc(10_000)], { account: lp.account });

    await token.write.mint([trader.account.address, usdc(1_000)]);
    await token.write.approve([pm.address, usdc(1_000)], { account: trader.account });

    // A funding shortfall on the push must not block opening — the price is still
    // fresh enough to read, which is what actually matters.
    await pm.write.openPosition([BTC, usdc(1_000), 100_000n, true, ["0xdeadbeef"]], {
      account: trader.account,
    });

    assert.equal(await pyth.read.updateCallCount(), 0n);
    assert.equal((await pm.read.getPosition([1n])).entryPrice, usd(180));
  });
});
