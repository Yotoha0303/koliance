import { describe, it, expect } from "vitest";
import {
  usdcToUsd,
  usdToUsdc,
  applyBps,
  positionSizeUsd,
  openFee,
  closeFee,
  unrealizedPnl,
  marginRatioBps,
  liquidationPrice,
  isLiquidatable,
  validateOpenPosition,
  BPS_DENOMINATOR,
  MAINTENANCE_MARGIN_BPS,
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
});
