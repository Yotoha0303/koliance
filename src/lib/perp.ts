/**
 * Koliance Perp — frontend bindings.
 *
 * Re-exports the shared constants from `./perpConfig` so the
 * frontend and the contracts can never drift apart, then adds the derived
 * math the UI needs.
 *
 * Do NOT restate any BPS constant or feed id in this file or anywhere else in
 * `src/`. Import them from here.
 */

import {
  BPS_DENOMINATOR,
  CLOSE_FEE_BPS,
  DEFAULT_FUNDING_RATE_PER_BLOCK_WAD,
  FEEDS,
  FEED_SYMBOLS,
  LIQUIDATOR_REWARD_BPS,
  MAINTENANCE_MARGIN_BPS,
  MAX_FUNDING_RATE_PER_BLOCK_WAD,
  MAX_LEVERAGE_BPS,
  MAX_PROFIT_BPS,
  MIN_LEVERAGE_BPS,
  OPEN_FEE_BPS,
  PERP_ADDRESSES,
  PERP_IS_CONFIGURED,
  SESSION_FEEDS,
  USD_DECIMALS,
  USDC_DECIMALS,
  WAD,
} from "./perpConfig";

export {
  BPS_DENOMINATOR,
  CLOSE_FEE_BPS,
  DEFAULT_FUNDING_RATE_PER_BLOCK_WAD,
  FEEDS,
  FEED_SYMBOLS,
  LIQUIDATOR_REWARD_BPS,
  MAINTENANCE_MARGIN_BPS,
  MAX_FUNDING_RATE_PER_BLOCK_WAD,
  MAX_LEVERAGE_BPS,
  MAX_PROFIT_BPS,
  MIN_LEVERAGE_BPS,
  OPEN_FEE_BPS,
  PERP_ADDRESSES,
  PERP_IS_CONFIGURED,
  SESSION_FEEDS,
  USD_DECIMALS,
  USDC_DECIMALS,
  WAD,
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

// ==================== FUNDING ====================
//
// Mirrors PositionManager's funding maths. Same-source discipline as the
// liquidation price: the UI's "funding owed" must equal what the contract will
// actually charge, or the displayed margin is a lie.
//
// Sign convention, which is the thing to get right:
//
//   index rises  <=>  longs dominate  <=>  longs pay
//   owed = signedSize * (indexNow - entryFundingIndex) / WAD
//          signedSize = +size for a long, -size for a short
//
// Positive owed means the trader PAYS. A short-heavy book pushes the index down,
// which makes a short's `-size * negative` positive — so the crowded short side
// pays, symmetrically.

/** Signed open-interest skew in WAD: `(long - short) / (long + short)`. */
export function fundingSkewWad(longOiUsd: bigint, shortOiUsd: bigint): bigint {
  const total = longOiUsd + shortOiUsd;
  if (total === 0n) return 0n;
  return ((longOiUsd - shortOiUsd) * WAD) / total;
}

/**
 * Per-block index delta for `elapsed` blocks at `ratePerBlockWad`.
 *
 * Mirrors `PositionManager._fundingDelta`. Note the two truncations, in this
 * order: elapsed*rate first, then the skew multiply. Changing the order changes
 * the result, which is why the contract's order is repeated here rather than
 * simplified.
 */
export function fundingDeltaWad(
  elapsed: bigint,
  ratePerBlockWad: bigint,
  skewWad: bigint
): bigint {
  if (skewWad === 0n) return 0n;
  return (elapsed * ratePerBlockWad * skewWad) / WAD;
}

/** The funding index projected forward `elapsed` blocks from `index`. */
export function projectedFundingIndex(
  index: bigint,
  elapsed: bigint,
  ratePerBlockWad: bigint,
  skewWad: bigint
): bigint {
  return index + fundingDeltaWad(elapsed, ratePerBlockWad, skewWad);
}

export interface FundingMath {
  sizeUsd: bigint;
  isLong: boolean;
  entryFundingIndex: bigint;
}

/**
 * Funding a position owes, positive meaning it pays.
 *
 * Mirrors `PositionManager._fundingFor`. The side multiplier is not optional:
 * without it both sides are charged identically and the thin side is never paid,
 * so funding stops being a transfer between the two sides.
 */
export function fundingOwed(p: FundingMath, indexNow: bigint): bigint {
  const delta = indexNow - p.entryFundingIndex;
  if (delta === 0n) return 0n;
  const signedSize = p.isLong ? p.sizeUsd : -p.sizeUsd;
  return (signedSize * delta) / WAD;
}

/**
 * Equity including collateral, PnL and funding, floored at zero.
 *
 * Mirrors `PositionManager._equityAfterFunding` and is the figure
 * `isLiquidatable` actually compares. Ordering is load-bearing: collateral + pnl
 * - funding, THEN the floor. Flooring the PnL first would let funding revive a
 * bankrupt position.
 */
export function equityWithFunding(
  collateralUsd: bigint,
  pnl: bigint,
  funding: bigint
): bigint {
  const equity = collateralUsd + pnl - funding;
  return equity < 0n ? 0n : equity;
}

/**
 * True when the position breaches maintenance margin, funding included.
 *
 * Supersedes `isLiquidatable` for on-chain parity: funding is part of the
 * contract's verdict, so a UI that omits it will disagree exactly when a crowded
 * position is being squeezed by the cost of carry — which is the case a demo is
 * most likely to be showing.
 *
 * `fundingOwedUsd` is positive when the trader pays, matching `fundingOwed`.
 */
export function isLiquidatableWithFunding(
  p: PositionMath,
  markPrice: bigint,
  fundingOwedUsd: bigint
): boolean {
  const size = positionSizeUsd(p);
  if (size === 0n) return false;
  const equity = equityWithFunding(
    p.collateralUsd,
    unrealizedPnl(p, markPrice),
    fundingOwedUsd
  );
  return equity <= applyBps(size, MAINTENANCE_MARGIN_BPS);
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
 * Liquidation price including accrued funding — MUST match the contract's
 * `_isLiquidatable` when funding is non-zero.
 *
 * Solving `collateral + pnl - funding == mm` for price:
 *   long : P = entry * (mm - collateral + funding + size) / size
 *   short: P = entry * (collateral + size - mm - funding) / size
 * where mm = size * MAINTENANCE_MARGIN_BPS / BPS_DENOMINATOR.
 *
 * That is the funding-free rearrangement with `funding` added to the numerator,
 * so `liquidationPriceWithFunding(p, 0n)` is bit-for-bit `liquidationPrice(p)` —
 * the two cannot drift apart, and the 60 golden vectors that pin the funding-free
 * case transitively pin this one at funding zero.
 *
 * `fundingOwedUsd` is positive when the trader pays, matching `fundingOwed`.
 * A payer is liquidated sooner (a long's price rises, a short's falls); one
 * receiving funding is liquidated later. This is the term that makes per-block
 * funding bite, and the reason a panel showing only `liquidationPrice` can
 * disagree with the chain's verdict on the same screen (GAP-37).
 *
 * Two integer divisions happen here (mm, then the final divide) and the contract
 * does the same two, so the results agree bit-for-bit. Changing the order of
 * operations in either place will desynchronise them.
 *
 * A return of `0n` means the boundary is not at a positive price — either the
 * collateral alone covers it, or (short branch) the position is already through
 * it. The caller should lean on the chain's `liquidatable` verdict for "is it
 * liquidatable right now" and treat this as the price, not the answer.
 */
export function liquidationPriceWithFunding(
  p: PositionMath,
  fundingOwedUsd: bigint
): bigint {
  const size = positionSizeUsd(p);
  if (size === 0n) return 0n;
  const mm = applyBps(size, MAINTENANCE_MARGIN_BPS);

  if (p.isLong) {
    const numerator = mm - p.collateralUsd + fundingOwedUsd + size;
    if (numerator <= 0n) return 0n; // collateral alone already covers it
    return (p.entryPrice * numerator) / size;
  }
  const numerator = p.collateralUsd + size - mm - fundingOwedUsd;
  if (numerator <= 0n) return 0n;
  return (p.entryPrice * numerator) / size;
}

/**
 * Liquidation price ignoring funding: the funding-free case of
 * `liquidationPriceWithFunding`. Kept as its own name because it is the figure
 * that answers "where is the price boundary", independent of the cost of carry.
 */
export function liquidationPrice(p: PositionMath): bigint {
  return liquidationPriceWithFunding(p, 0n);
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
