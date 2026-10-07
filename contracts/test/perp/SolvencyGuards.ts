import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

/**
 * Solvency guards — negative cases for GAP-01/02/03/04/05.
 *
 * Every `it` in this file is a FALSIFICATION CASE: it reproduces an observed
 * failure of the pre-fix contracts and asserts the corrected behaviour. On the
 * pre-fix code these tests FAIL; that is their value. See
 * `docs/planning/缺陷分析-审计报告.md` §4.1 for the raw probe output each one encodes.
 *
 * Invariant under test, in one line:
 *
 *     for any operation sequence:  totalAssets() >= reservedAssets()
 *
 * If that holds, `Vault.payOut` can never revert for insufficient liquidity,
 * which is what makes a position un-closeable today (GAP-01).
 *
 * Sizing note. With `MAX_PROFIT_BPS = 10_000` a 10x position's payout cap is
 * `collateral + notional` ≈ 11x its collateral, so a pool must hold that much
 * for the position to open at all. The pool sizes below are chosen to satisfy
 * that gate — a smaller pool gets refused at open, which is itself GAP-04.
 */

const E18 = 10n ** 18n;
const E6 = 10n ** 6n;
const usd = (n: bigint | number) => BigInt(n) * E18;
const usdc = (n: bigint | number) => BigInt(n) * E6;

const NVDA = "0xa470c4ac46f44b547b2cba52338f311fb642b79375ce5f0cfd5cb5b99227b852" as const;
const BPS = 10_000n;

/** One USDC in 18-decimal USD. Anything below this truncates to 0 USDC. */
const ONE_USDC_WEI = E18 / E6;

describe("Solvency guards (GAP-01/02/03/04/05)", async function () {
  const { viem } = await network.getOrCreate();
  const [deployer, lp, trader, liquidator] = await viem.getWalletClients();

  /** Deploy the stack and fund the LP with `poolUsdc`. */
  async function setup(poolUsdc: bigint = usdc(20_000)) {
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

    await token.write.mint([lp.account.address, poolUsdc]);
    await token.write.approve([vault.address, poolUsdc], { account: lp.account });
    await vault.write.addLiquidity([poolUsdc], { account: lp.account });

    for (const who of [trader, liquidator]) {
      await token.write.mint([who.account.address, usdc(500_000)]);
      await token.write.approve([pm.address, usdc(500_000)], { account: who.account });
    }
    return { token, oracle, vault, pm };
  }

  /**
   * Open a position and return its id.
   *
   * `pm.write.openPosition` resolves to the TRANSACTION HASH, not the id —
   * reading the id back is the only correct way.
   */
  async function open(
    pm: any,
    who: any,
    opts: { collateral?: bigint; leverageBps?: bigint; isLong?: boolean } = {}
  ): Promise<bigint> {
    const { collateral = usdc(1_000), leverageBps = 100_000n, isLong = true } = opts;
    await pm.write.openPosition([NVDA, collateral, leverageBps, isLong, []], {
      account: who.account,
    });
    return await pm.read.nextPositionId();
  }

  /** Notional size for a position, mirroring the contract. */
  function sizeOf(collateralUsd: bigint, lev: bigint): bigint {
    return (collateralUsd * lev) / BPS;
  }

  /**
   * The price at which a long's equity equals `targetEquity` (18-decimal USD).
   *
   *   equity(p) = collateral + size * (p - entry) / entry
   *     =>  p = entry * (size + targetEquity - collateral) / size
   *
   * Choosing `targetEquity` just under `ONE_USDC_WEI` lands the position in the
   * window where a payout truncates to 0 USDC — the window that used to make
   * `Vault.payOut` revert and brick the position (PROBE-A), and to make a whole
   * liquidation batch roll back (PROBE-C).
   */
  function priceForEquity(
    targetEquity: bigint,
    entry: bigint,
    collateralUsd: bigint,
    lev: bigint
  ): bigint {
    const size = sizeOf(collateralUsd, lev);
    return (entry * (size + targetEquity - collateralUsd)) / size;
  }

  /** Assert the invariant that keeps `payOut` from ever reverting. */
  async function assertSolvent(vault: any, pm: any, label: string) {
    const assets = await vault.read.totalAssets();
    const reserved = await pm.read.reservedAssets();
    assert.ok(
      assets >= reserved,
      `${label}: insolvent — totalAssets=${assets} < reservedAssets=${reserved}`
    );
  }

  // ==================== GAP-03: LP must not drain the pool ====================

  it("GAP-03: an LP cannot drain principal below the pool's obligation (falsifies PROBE-F)", async function () {
    const { token, oracle, vault, pm } = await setup(usdc(20_000));

    const id = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });

    // +12%: pnl = 9990 * 0.12 = 1198.8 USD, above the 999 principal — the exact
    // shape of PROBE-F, where the LP could extract to `principal` and strand it.
    await oracle.write.setPrice([NVDA, (usd(180) * 11_200n) / BPS]);
    const pnl = await pm.read.unrealizedPnl([id]);
    assert.ok(pnl > 0n, "position is in profit — this is not a loss case");

    const reserved = await pm.read.reservedAssets();
    assert.ok(
      reserved >= usd(999) + pnl,
      `reserve ${reserved} must cover the obligation ${usd(999) + pnl}`
    );

    // Let the LP take everything the contract permits. Pre-fix this is
    // `assets - principal`, which leaves the pool unable to pay the trader.
    const shares = await vault.read.sharesOf([lp.account.address]);
    const totalShares = await vault.read.totalShares();
    const assets = await vault.read.totalAssets();
    const available = await vault.read.availableAssets();
    const maxBurn = (available * totalShares) / assets;
    await vault.write.removeLiquidity([maxBurn], { account: lp.account });

    await assertSolvent(vault, pm, "after max LP exit");

    // After the largest permitted exit the trader must still be paid in full.
    const before = await token.read.balanceOf([trader.account.address]);
    await pm.write.closePosition([id, 0n, 0n, []], { account: trader.account });
    const gained = (await token.read.balanceOf([trader.account.address])) - before;

    assert.ok(gained > 0n, "trader must be paid after the LP's maximum exit");
    assert.equal(await pm.read.isOpen([id]), false);
  });

  // ==================== GAP-04: pool capacity gate on open ====================

  it("GAP-04: opening is refused once the pool cannot cover the payout cap (falsifies PROBE2)", async function () {
    // 1,000 pool, a 1,000-collateral 50x position: cap ≈ 999 + 49,950 = 50,949,
    // far beyond the pool. Pre-fix this opened happily and only blew up at close.
    const { pm } = await setup(usdc(1_000));

    await assert.rejects(
      pm.write.openPosition([NVDA, usdc(1_000), 500_000n, true, []], {
        account: trader.account,
      }),
      "a position whose payout cap exceeds the pool must be refused at open"
    );
  });

  it("GAP-04: a position that fits the pool still opens", async function () {
    const { pm } = await setup(usdc(10_000));

    const id = await open(pm, trader, { collateral: usdc(100), leverageBps: 100_000n });

    assert.equal(await pm.read.isOpen([id]), true);
  });

  it("GAP-04: the solvency invariant holds after a position opens", async function () {
    const { vault, pm } = await setup(usdc(10_000));
    await open(pm, trader, { collateral: usdc(500), leverageBps: 100_000n });
    await assertSolvent(vault, pm, "after open");
  });

  // ==================== GAP-01: a close must never brick ====================

  it("GAP-01: a close whose equity truncates to zero USDC still succeeds (falsifies PROBE-A)", async function () {
    const { token, oracle, pm } = await setup(usdc(20_000));
    const id = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });

    // Equity of half a USDC in 18-decimal terms: strictly positive, so the old
    // code took the `if (equity > 0)` branch, yet `usdToUsdc` truncated it to 0
    // and `Vault.payOut` reverted with ZeroAmount.
    const hazard = priceForEquity(ONE_USDC_WEI / 2n, usd(180), usd(999), 100_000n);
    await oracle.write.setPrice([NVDA, hazard]);

    const equity = await pm.read.unrealizedPnl([id]);
    assert.ok(equity < 0n, "position is under water — the hazard case");

    // Pre-fix: reverted, leaving isOpen == true and the margin stranded forever.
    await pm.write.closePosition([id, 0n, 0n, []], { account: trader.account });
    assert.equal(await pm.read.isOpen([id]), false, "position must close, not brick");
  });

  it("GAP-01: profit beyond the cap is capped, not bricked", async function () {
    const { oracle, pm } = await setup(usdc(50_000));
    const id = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });

    // 10x long, entry 180 -> 720 is +300%: pnl = 29,970 USD, far past a cap of
    // collateral + notional = 10,989. Paying that uncapped is the PROBE-B path.
    await oracle.write.setPrice([NVDA, usd(720)]);

    const p = await pm.read.getPosition([id]);
    assert.ok(p.payoutCapUsd > 0n, "a payout cap must exist");

    await pm.write.closePosition([id, 0n, 0n, []], { account: trader.account });
    assert.equal(await pm.read.isOpen([id]), false, "a capped close must still settle");
  });

  // ==================== GAP-02: batch must not be poisoned ====================

  it("GAP-02: one unpayable position must not poison a whole batch (falsifies PROBE-C)", async function () {
    const { oracle, pm } = await setup(usdc(100_000));

    const a = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });
    const b = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });

    // The poisoning case is NOT the plain liquidation price (equity there is ~100
    // USD and the payout succeeds). It is when equity is small enough that the
    // 5% bounty is non-zero in USD yet truncates to 0 USDC: then `reward > 0` is
    // taken, `payOut` reverts, and the whole batch rolls back.
    const hazard = priceForEquity(ONE_USDC_WEI, usd(180), usd(999), 100_000n);
    await oracle.write.setPrice([NVDA, hazard]);
    assert.equal(await pm.read.isLiquidatable([a]), true);
    assert.equal(await pm.read.isLiquidatable([b]), true);

    await pm.write.liquidate([[a, b], []], { account: liquidator.account });

    // Pre-fix this call reverted and both stayed open.
    assert.equal(await pm.read.isOpen([a]), false, "position a must be liquidated");
    assert.equal(await pm.read.isOpen([b]), false, "position b must be liquidated");
  });

  // ==================== GAP-05: liquidator bounty must not be zero ====================

  it("GAP-05: a bankrupt position still pays the liquidator a bounty", async function () {
    const { token, oracle, pm } = await setup(usdc(20_000));
    const id = await open(pm, trader, { collateral: usdc(1_000), leverageBps: 100_000n });

    // Far past the ~163.8 threshold: equity is clamped to zero, which is exactly
    // the case where the old bounty formula (equity * 5%) paid nothing.
    await oracle.write.setPrice([NVDA, usd(100)]);
    assert.equal(await pm.read.isLiquidatable([id]), true);

    const before = await token.read.balanceOf([liquidator.account.address]);
    await pm.write.liquidate([[id], []], { account: liquidator.account });
    const gained = (await token.read.balanceOf([liquidator.account.address])) - before;

    assert.ok(gained > 0n, `liquidator must be paid on a bankrupt position, got ${gained}`);
    assert.equal(await pm.read.isOpen([id]), false);
  });
});
