/**
 * Koliance Perp — frontend bindings.
 *
 * Re-exports the shared constants from `contracts/lib/perpConfig.ts` so the
 * frontend and the contracts can never drift apart, then adds the derived
 * math the UI needs.
 *
 * Do NOT restate any BPS constant or feed id in this file or anywhere else in
 * `src/`. Import them from here.
 */

import {
  BPS_DENOMINATOR,
  CLOSE_FEE_BPS,
  FEEDS,
  FEED_SYMBOLS,
  LIQUIDATOR_REWARD_BPS,
  MAINTENANCE_MARGIN_BPS,
  MAX_LEVERAGE_BPS,
  MAX_PROFIT_BPS,
  MIN_LEVERAGE_BPS,
  OPEN_FEE_BPS,
  PERP_ADDRESSES,
  PERP_IS_CONFIGURED,
  SESSION_FEEDS,
  USD_DECIMALS,
  USDC_DECIMALS,
} from "./perpConfig";

export {
  BPS_DENOMINATOR,
  CLOSE_FEE_BPS,
  FEEDS,
  FEED_SYMBOLS,
  LIQUIDATOR_REWARD_BPS,
  MAINTENANCE_MARGIN_BPS,
  MAX_LEVERAGE_BPS,
  MAX_PROFIT_BPS,
  MIN_LEVERAGE_BPS,
  OPEN_FEE_BPS,
  PERP_ADDRESSES,
  PERP_IS_CONFIGURED,
  SESSION_FEEDS,
  USD_DECIMALS,
  USDC_DECIMALS,
};

export type { FeedSymbol } from "./perpConfig";

// ==================== SCALE HELPERS ====================

/** USDC (6 decimals) -> internal 18-decimal USD representation. */
export function usdcToUsd(usdcAmount: bigint): bigint {
  return usdcAmount * 10n ** BigInt(USD_DECIMALS - USDC_DECIMALS);
}

/** Internal 18-decimal USD -> USDC (6 decimals). Truncates. */
export function usdToUsdc(usdAmount: bigint): bigint {
  return usdAmount / 10n ** BigInt(USD_DECIMALS - USDC_DECIMALS);
}

/** Basis points -> multiplier. `applyBps(1000n, 500n)` = 50 (i.e. 5%). */
export function applyBps(amount: bigint, bps: bigint): bigint {
  return (amount * bps) / BPS_DENOMINATOR;
}

/** Format an 18-decimal USD value for display. */
export function formatUsd(usdAmount: bigint, decimals = 2): string {
  const negative = usdAmount < 0n;
  const abs = negative ? -usdAmount : usdAmount;
  const whole = abs / 10n ** BigInt(USD_DECIMALS);
  const frac = abs % 10n ** BigInt(USD_DECIMALS);
  const fracStr = frac.toString().padStart(USD_DECIMALS, "0").slice(0, decimals);
  return `${negative ? "-" : ""}${whole.toLocaleString()}.${fracStr}`;
}

/** Format a BPS leverage value as a human multiplier, e.g. 250000n -> "25x". */
export function formatLeverage(leverageBps: bigint): string {
  const whole = leverageBps / BPS_DENOMINATOR;
  const frac = leverageBps % BPS_DENOMINATOR;
  if (frac === 0n) return `${whole}x`;
  return `${whole}.${(frac / 100n).toString().padStart(2, "0")}x`;
}

// ==================== POSITION MATH ====================

export interface PositionMath {
  collateralUsd: bigint;
  entryPrice: bigint; // 18 decimals
  leverageBps: bigint;
  isLong: boolean;
}

/** Notional size in USD: collateral * leverage. */
export function positionSizeUsd(p: PositionMath): bigint {
  return applyBps(p.collateralUsd, p.leverageBps);
}

/**
 * Collateral credited to a position, in 18-decimal USD: the gross amount after
 * the open fee. Mirrors `PositionManager._netCollateralUsd`.
 *
 * The fee is charged on the GROSS deposit, and size is derived from the net —
 * so a UI that computes size from the raw deposit will disagree with the chain
 * by the fee.
 */
export function netCollateralUsd(grossUsd: bigint): bigint {
  return grossUsd - applyBps(grossUsd, OPEN_FEE_BPS);
}

/**
 * The most a position can ever be paid out, in 18-decimal USD.
 *
 * Mirrors `PositionManager._payoutCapUsd`. Must agree with the contract: the
 * pool reserves this full amount, so it drives both whether an open will be
 * accepted (`PoolCapacity`) and how much liquidity a demo needs.
 *
 *   cap = netCollateral + size * MAX_PROFIT_BPS / BPS
 */
export function payoutCapUsd(p: PositionMath): bigint {
  return p.collateralUsd + applyBps(positionSizeUsd(p), MAX_PROFIT_BPS);
}

/**
 * Whether the pool is deep enough to accept this position.
 *
 * Mirrors the `InsufficientPoolCapacity` check in `openPosition`. The contract
 * compares against `totalAssets()`, which already includes the collateral being
 * deposited, so that is added here too.
 *
 * Returns the numbers rather than a bare boolean so the UI can explain the
 * shortfall instead of just disabling a button.
 */
export function poolCapacityCheck(
  p: PositionMath,
  poolAssetsUsd: bigint,
  currentReservedUsd: bigint
): { ok: boolean; requiredUsd: bigint; availableUsd: bigint } {
  const requiredUsd = currentReservedUsd + payoutCapUsd(p);
  const availableUsd = poolAssetsUsd + p.collateralUsd;
  return { ok: availableUsd >= requiredUsd, requiredUsd, availableUsd };
}

/** Entry fee deducted from collateral on open. */
export function openFee(p: PositionMath): bigint {
  return applyBps(p.collateralUsd, OPEN_FEE_BPS);
}

/** Close fee, charged against collateral. */
export function closeFee(p: PositionMath): bigint {
  return applyBps(p.collateralUsd, CLOSE_FEE_BPS);
}

/**
 * Unrealised PnL at `markPrice`.
 * long : size * (mark - entry) / entry
 * short: size * (entry - mark) / entry
 */
export function unrealizedPnl(p: PositionMath, markPrice: bigint): bigint {
  const size = positionSizeUsd(p);
  const delta = p.isLong ? markPrice - p.entryPrice : p.entryPrice - markPrice;
  return (size * delta) / p.entryPrice;
}

/** Margin ratio in BPS: (collateral + pnl) / size. 10000n = 100%. */
export function marginRatioBps(p: PositionMath, markPrice: bigint): bigint {
  const size = positionSizeUsd(p);
  if (size === 0n) return 0n;
  const equity = p.collateralUsd + unrealizedPnl(p, markPrice);
  if (equity <= 0n) return 0n;
  return (equity * BPS_DENOMINATOR) / size;
}

/**
 * Liquidation price — MUST match `PositionManager.isLiquidatable` exactly.
 *
 * Solves `collateral + pnl == size * MMR` for price:
 *   long : P = entry * (mm - collateral + size) / size
 *   short: P = entry * (collateral + size - mm) / size
 * where mm = size * MAINTENANCE_MARGIN_BPS / BPS_DENOMINATOR.
 *
 * Two integer divisions happen here (mm, then the final divide) and the contract
 * does the same two, so the results agree bit-for-bit. Changing the order of
 * operations in either place will desynchronise them.
 */
export function liquidationPrice(p: PositionMath): bigint {
  const size = positionSizeUsd(p);
  if (size === 0n) return 0n;
  const mm = applyBps(size, MAINTENANCE_MARGIN_BPS);

  if (p.isLong) {
    const numerator = mm - p.collateralUsd + size;
    if (numerator <= 0n) return 0n; // collateral alone already covers it
    return (p.entryPrice * numerator) / size;
  }
  const numerator = p.collateralUsd + size - mm;
  if (numerator <= 0n) return 0n;
  return (p.entryPrice * numerator) / size;
}

/** True when the position would be liquidated at `markPrice`. */
export function isLiquidatable(p: PositionMath, markPrice: bigint): boolean {
  const size = positionSizeUsd(p);
  if (size === 0n) return false;
  const equity = p.collateralUsd + unrealizedPnl(p, markPrice);
  return equity <= applyBps(size, MAINTENANCE_MARGIN_BPS);
}

/** Liquidator bounty for a position being liquidated at `markPrice`. */
export function liquidationReward(p: PositionMath, markPrice: bigint): bigint {
  const equity = p.collateralUsd + unrealizedPnl(p, markPrice);
  if (equity <= 0n) return 0n;
  return applyBps(equity, LIQUIDATOR_REWARD_BPS);
}

// ==================== VALIDATION ====================

export interface OpenPositionInput {
  collateralUsd: bigint;
  leverageBps: bigint;
}

/** Mirrors the on-chain guards so the UI can disable a submit button before it reverts. */
export function validateOpenPosition(input: OpenPositionInput): string | null {
  if (input.collateralUsd <= 0n) return "Collateral must be greater than zero";
  if (input.leverageBps < MIN_LEVERAGE_BPS) {
    return `Leverage below minimum (${formatLeverage(MIN_LEVERAGE_BPS)})`;
  }
  if (input.leverageBps > MAX_LEVERAGE_BPS) {
    return `Leverage above maximum (${formatLeverage(MAX_LEVERAGE_BPS)})`;
  }
  return null;
}
