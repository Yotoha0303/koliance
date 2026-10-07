/**
 * Koliance Perp — shared constants. CANONICAL LOCATION.
 *
 * SINGLE SOURCE OF TRUTH for fee / margin / leverage basis points and Pyth feed ids.
 *
 * Where the numbers actually come from
 * ------------------------------------
 * Solidity cannot import this file, so values the CONTRACTS consume at compile
 * time also exist in `contracts/contracts/perp/PerpConstants.sol`. The two are
 * mirrors; the deployment is the tiebreaker.
 *
 *   - fee / margin / leverage bps -> defined in PerpConstants.sol, mirrored here.
 *     At runtime, read the getters on IPositionManager: they report what was
 *     actually deployed, so they cannot go stale.
 *   - Pyth feed ids               -> defined HERE only. They are passed into the
 *     contracts as call arguments and never need to be hardcoded on chain, so
 *     there is nothing to mirror.
 *
 * Contracts must NOT import this file back: `contracts/` is ESM (`type: module`)
 * while the root package is not, and the cross-boundary import breaks `tsc`.
 *
 * This file lives under `src/` because `.vercelignore` excludes `contracts/` from
 * the Vercel build, so anything the frontend imports must sit inside the deployed
 * tree.
 *
 * If the frontend's estimated liquidation price drifts from the on-chain
 * liquidation price, the demo loses all credibility on stage. Sharing one file
 * is what prevents that.
 */

/** Basis-point denominator. All BPS constants below are relative to this. */
export const BPS_DENOMINATOR = 10_000n;

/** 0.1% fee charged on open, deducted from collateral and paid into the Vault. */
export const OPEN_FEE_BPS = 10n;

/** 0.1% fee charged on close. */
export const CLOSE_FEE_BPS = 10n;

/**
 * 1% maintenance margin. A position is liquidatable once
 * `collateralUsd + pnl <= sizeUsd * MAINTENANCE_MARGIN_BPS / BPS_DENOMINATOR`.
 */
export const MAINTENANCE_MARGIN_BPS = 100n;

/** 5% of remaining collateral paid to the liquidator as a bounty. */
export const LIQUIDATOR_REWARD_BPS = 500n;

/** 50x ceiling. openPosition reverts above this. */
export const MAX_LEVERAGE_BPS = 500_000n;

/** 1x floor — below this it is not a leveraged position. */
export const MIN_LEVERAGE_BPS = 10_000n;

/** USDC has 6 decimals; all USD values in the contracts use 18. */
export const USDC_DECIMALS = 6;
export const USD_DECIMALS = 18;

/**
 * Pyth feed ids on Monad.
 *
 * The `Index` variants are 24/7: outside traditional market hours they follow a
 * defined Pyth methodology rather than tracking the last exchange print. Use them
 * for the demo so prices keep moving at night and on weekends. The `Equity.US.*`
 * feeds only update during the US session.
 *
 * Verified against Pyth Hermes on 2026-10-05.
 */
export const FEEDS = {
  /** Equity.Index.NVDA/USD — "PYTH PRICE IN USD FOR NVDA 24/7" */
  NVDA: "0xa470c4ac46f44b547b2cba52338f311fb642b79375ce5f0cfd5cb5b99227b852",
  /** Equity.Index.TSLA/USD — 24/7 */
  TSLA: "0xe6da44bff5b8b06897a3739dd331b440d6662595bb862e37046892c568ae3fc0",
  /** Crypto.BTC/USD — 24/7 */
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
} as const;

/** Session-only `Equity.US.*` feeds, kept for reference / comparison in the demo. */
export const SESSION_FEEDS = {
  NVDA: "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593",
  TSLA: "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
} as const;

export type FeedSymbol = keyof typeof FEEDS;

export const FEED_SYMBOLS = Object.keys(FEEDS) as FeedSymbol[];
