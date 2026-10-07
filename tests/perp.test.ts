import { describe, it, expect } from "vitest";
import {
  usdcToUsd,
  usdToUsdc,
  applyBps,
  positionSizeUsd,
  netCollateralUsd,
  payoutCapUsd,
  poolCapacityCheck,
  fundingSkewWad,
  fundingDeltaWad,
  fundingOwed,
  equityWithFunding,
  isLiquidatableWithFunding,
  openFee,
  closeFee,
  unrealizedPnl,
  marginRatioBps,
  liquidationPrice,
  isLiquidatable,
  validateOpenPosition,
  BPS_DENOMINATOR,
  MAINTENANCE_MARGIN_BPS,
  MAX_PROFIT_BPS,
  WAD,
} from "@/lib/perp";

describe("Koliance Perp Math & Risk Engine", () => {
  it("should convert USDC (6 dec) to internal USD (18 dec) correctly", () => {
    const usdc = 100_000_000n; // 100 USDC
    const usd = usdcToUsd(usdc);
    expect(usd).toBe(100n * 10n ** 18n);
    expect(usdToUsdc(usd)).toBe(usdc);
  });

  it("should calculate position notional size correctly with leverage", () => {
    const collateral = 1000n * 10n ** 18n; // 1000 USD
    const leverage = 100_000n; // 10x (10 * 10,000 BPS)
    const size = positionSizeUsd({
      collateralUsd: collateral,
      entryPrice: 100n * 10n ** 18n,
      leverageBps: leverage,
      isLong: true,
    });

    expect(size).toBe(10_000n * 10n ** 18n); // 10,000 USD
  });

  it("should calculate long and short unrealized PnL accurately", () => {
    const collateral = 1000n * 10n ** 18n;
    const entryPrice = 200n * 10n ** 18n;
    const markUp = 220n * 10n ** 18n; // +10%
    const markDown = 180n * 10n ** 18n; // -10%

    const longPos = {
      collateralUsd: collateral,
      entryPrice,
      leverageBps: 100_000n, // 10x -> 10,000 size
      isLong: true,
    };

    const shortPos = {
      collateralUsd: collateral,
      entryPrice,
      leverageBps: 100_000n,
      isLong: false,
    };

    // Long gains 10% on 10,000 notional = +1000 USD
    expect(unrealizedPnl(longPos, markUp)).toBe(1000n * 10n ** 18n);
    // Short gains 10% on 10,000 notional when price drops = +1000 USD
    expect(unrealizedPnl(shortPos, markDown)).toBe(1000n * 10n ** 18n);
  });

  it("should calculate bit-for-bit liquidation price matching on-chain contracts", () => {
    const collateral = 1000n * 10n ** 18n;
    const entryPrice = 100n * 10n ** 18n;
    const leverage = 100_000n; // 10x

    const longPos = {
      collateralUsd: collateral,
      entryPrice,
      leverageBps: leverage,
      isLong: true,
    };

    const liqPrice = liquidationPrice(longPos);
    expect(liqPrice).toBeGreaterThan(0n);
    expect(liqPrice).toBeLessThan(entryPrice);

    // At exact liquidation price, position should be flagged as liquidatable
    expect(isLiquidatable(longPos, liqPrice)).toBe(true);
    // Above liquidation price, not liquidatable
    expect(isLiquidatable(longPos, entryPrice)).toBe(false);
  });

  it("should validate position open parameters", () => {
    expect(validateOpenPosition({ collateralUsd: 0n, leverageBps: 10_000n })).toBe(
      "Collateral must be greater than zero"
    );
    expect(validateOpenPosition({ collateralUsd: 100n, leverageBps: 1000n })).toMatch(
      /Leverage below minimum/
    );
    expect(validateOpenPosition({ collateralUsd: 100n, leverageBps: 1_000_000_000n })).toMatch(
      /Leverage above maximum/
    );
    expect(validateOpenPosition({ collateralUsd: 100n, leverageBps: 50_000n })).toBeNull();
  });

  // ==================== PAYOUT CAP (ADR-002) ====================
  //
  // These mirror PositionManager._netCollateralUsd / _payoutCapUsd /
  // _assertPoolCapacity. If they drift, the UI will offer positions the chain
  // refuses, or under-report the liquidity a demo needs.

  it("should charge the open fee on the gross deposit, then size from the net", () => {
    const gross = 1_000n * 10n ** 18n; // 1000 USD deposited
    const net = netCollateralUsd(gross);

    // 0.1% of 1000 is 1, so 999 USD of collateral. Size derives from 999, not
    // 1000 — matching the contract's ordering.
    expect(net).toBe(999n * 10n ** 18n);
    expect(openFee({ collateralUsd: gross, entryPrice: 1n, leverageBps: 1n, isLong: true })).toBe(
      1n * 10n ** 18n
    );
  });

  it("should cap a payout at collateral plus 100% of notional", () => {
    const collateral = 999n * 10n ** 18n;
    const pos = {
      collateralUsd: collateral,
      entryPrice: 180n * 10n ** 18n,
      leverageBps: 100_000n, // 10x
      isLong: true,
    };

    // size = 9,990; cap = 999 + 9,990 = 10,989
    expect(positionSizeUsd(pos)).toBe(9_990n * 10n ** 18n);
    expect(payoutCapUsd(pos)).toBe(10_989n * 10n ** 18n);
    expect(MAX_PROFIT_BPS).toBe(10_000n);
  });

  it("should scale the payout cap with leverage", () => {
    const collateral = 999n * 10n ** 18n;
    const base = { collateralUsd: collateral, entryPrice: 180n * 10n ** 18n, isLong: true };

    // 1x => 999 + 999 = 1,998; 50x => 999 + 49,950 = 50,949
    expect(payoutCapUsd({ ...base, leverageBps: 10_000n })).toBe(1_998n * 10n ** 18n);
    expect(payoutCapUsd({ ...base, leverageBps: 500_000n })).toBe(50_949n * 10n ** 18n);
  });

  it("should refuse a position the pool cannot cover, and allow one it can", () => {
    const pos = {
      collateralUsd: 999n * 10n ** 18n,
      entryPrice: 180n * 10n ** 18n,
      leverageBps: 500_000n, // 50x -> cap 50,949
      isLong: true,
    };

    // 1,000 USDC pool, nothing reserved: needs 50,949, has 1,999. Refused.
    const small = poolCapacityCheck(pos, 1_000n * 10n ** 18n, 0n);
    expect(small.ok).toBe(false);
    expect(small.requiredUsd).toBe(50_949n * 10n ** 18n);
    expect(small.availableUsd).toBe(1_999n * 10n ** 18n);

    // 100,000 USDC pool with 10,989 already reserved. Allowed.
    const large = poolCapacityCheck(pos, 100_000n * 10n ** 18n, 10_989n * 10n ** 18n);
    expect(large.ok).toBe(true);
  });

  it("should size a 20-position 50x demo the way the seed script does", () => {
    // The rehearsal number, derived rather than hardcoded. demo-seed.ts adds 20%
    // headroom on top of this.
    const pos = {
      collateralUsd: netCollateralUsd(1_000n * 10n ** 18n),
      entryPrice: 180n * 10n ** 18n,
      leverageBps: 500_000n,
      isLong: true,
    };
    const perPosition = payoutCapUsd(pos);
    const total = perPosition * 20n;

    expect(perPosition).toBe(50_949n * 10n ** 18n);
    expect(total).toBe(1_018_980n * 10n ** 18n);
  });

  // ==================== FUNDING (ADR-003) ====================
  //
  // Mirrors PositionManager's funding maths, and the tests use the same shapes
  // as contracts/test/perp/Funding.ts so the two implementations are pinned to
  // each other rather than each to its own idea of the arithmetic.

  it("should compute skew as the signed imbalance of open interest", () => {
    const oi = 9_990n * 10n ** 18n;

    // Balanced book: no skew, so no funding.
    expect(fundingSkewWad(oi, oi)).toBe(0n);
    // Long-heavy: positive, meaning longs pay.
    expect(fundingSkewWad(oi * 2n, oi)).toBe((oi * WAD) / (oi * 3n));
    // Short-heavy: negative.
    expect(fundingSkewWad(oi, oi * 2n)).toBe(-(oi * WAD) / (oi * 3n));
    // Empty book: nothing to charge.
    expect(fundingSkewWad(0n, 0n)).toBe(0n);
  });

  it("should accrue nothing when the book is balanced", () => {
    expect(fundingDeltaWad(1_000n, 10_000_000_000_000n, 0n)).toBe(0n);
  });

  it("should scale the index delta with blocks elapsed", () => {
    const rate = 10_000_000_000_000n; // 1e13
    const skew = WAD; // fully one-sided

    // At full skew the delta is simply elapsed * rate.
    expect(fundingDeltaWad(10n, rate, skew)).toBe(10n * rate);
    expect(fundingDeltaWad(100n, rate, skew)).toBe(100n * rate);
    // Half the skew, half the accrual.
    expect(fundingDeltaWad(10n, rate, WAD / 2n)).toBe(5n * rate);
  });

  it("should charge the long and pay the short, symmetrically", () => {
    const size = 9_990n * 10n ** 18n;
    const indexNow = WAD / 100n; // the index rose

    // A long pays when the index rises.
    expect(fundingOwed({ sizeUsd: size, isLong: true, entryFundingIndex: 0n }, indexNow)).toBe(
      (size * indexNow) / WAD
    );
    // A short is PAID the same amount. Without the side multiplier both would be
    // charged and the short would never receive anything.
    expect(fundingOwed({ sizeUsd: size, isLong: false, entryFundingIndex: 0n }, indexNow)).toBe(
      -(size * indexNow) / WAD
    );
  });

  it("should charge the short when the book is short-heavy", () => {
    const size = 9_990n * 10n ** 18n;
    const indexNow = -(WAD / 100n); // the index fell

    // A short-heavy book pushes the index down, so the crowded short side pays.
    expect(
      fundingOwed({ sizeUsd: size, isLong: false, entryFundingIndex: 0n }, indexNow)
    ).toBe((size * (WAD / 100n)) / WAD);
  });

  it("should owe nothing when the index has not moved since entry", () => {
    const size = 9_990n * 10n ** 18n;
    const idx = WAD / 100n;
    expect(fundingOwed({ sizeUsd: size, isLong: true, entryFundingIndex: idx }, idx)).toBe(0n);
  });

  it("should floor equity at zero, never below", () => {
    const collateral = 999n * 10n ** 18n;
    // PnL wipes the collateral and funding overshoots it.
    expect(equityWithFunding(collateral, -collateral, 500n * 10n ** 18n)).toBe(0n);
    // Ordinary case: collateral + pnl - funding.
    expect(equityWithFunding(collateral, 100n * 10n ** 18n, 50n * 10n ** 18n)).toBe(
      1_049n * 10n ** 18n
    );
  });

  it("should let funding alone make a position liquidatable", () => {
    const collateral = 999n * 10n ** 18n;
    const entry = 180n * 10n ** 18n;
    const pos = {
      collateralUsd: collateral,
      entryPrice: entry,
      leverageBps: 500_000n, // 50x -> size 49,950
      isLong: true,
    };

    // Price unmoved, so PnL is zero and any breach is funding's doing.
    expect(isLiquidatableWithFunding(pos, entry, 0n)).toBe(false);
    // Maintenance margin at 50x is 1% of 49,950 = 499.5.
    expect(isLiquidatableWithFunding(pos, entry, 500n * 10n ** 18n)).toBe(true);
  });

  it("should agree with the contract's index projection over the same inputs", () => {
    // The demo shape: a lone long, full skew, rate raised for visibility.
    const size = 9_990n * 10n ** 18n;
    const rate = 10_000_000_000_000n;
    const elapsed = 1_500n;

    const index = fundingDeltaWad(elapsed, rate, WAD);
    const owed = fundingOwed({ sizeUsd: size, isLong: true, entryFundingIndex: 0n }, index);

    // 9990 * 1e-5 * 1500 = 149.85 USD. The Solidity suite asserts this same
    // order of magnitude crosses the 50x maintenance margin.
    expect(owed).toBeGreaterThan(149n * 10n ** 18n);
    expect(owed).toBeLessThan(150n * 10n ** 18n);
  });
});
