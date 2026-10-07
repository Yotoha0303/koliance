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

/**
 * Profit ceiling, in basis points of notional size.
 *
 * A position's payout never exceeds `collateral + size * MAX_PROFIT_BPS / 1e4`.
 * Mirrors `PerpConstants.MAX_PROFIT_BPS`; read `IPositionManager.maxProfitBps()`
 * for the authoritative deployed value.
 *
 * This is load-bearing for the UI, not just a display constant: the pool must
 * reserve each position's full payout cap, so opening needs a pool at least as
 * deep as the sum of the caps. `payoutCapUsd()` in `perp.ts` computes the same
 * figure the contract will enforce.
 */
export const MAX_PROFIT_BPS = 10_000n;

/**
 * Funding accrued per block at full skew, WAD-scaled. Mirrors
 * `PerpConstants.DEFAULT_FUNDING_RATE_PER_BLOCK_WAD`.
 *
 * This is a DEFAULT, not what is deployed. The owner can retune it up to
 * `MAX_FUNDING_RATE_PER_BLOCK_WAD`, so read
 * `IPositionManager.fundingRatePerBlockWad()` for the authoritative value — the
 * UI must use that, not this, or its displayed funding will be wrong.
 */
export const DEFAULT_FUNDING_RATE_PER_BLOCK_WAD = 100_000_000_000n; // 1e11

/** Ceiling on the owner-settable rate. Mirrors `PerpConstants`. */
export const MAX_FUNDING_RATE_PER_BLOCK_WAD = 10_000_000_000_000n; // 1e13

/** Fixed-point denominator for WAD maths (the funding index and skew). */
export const WAD = 10n ** 18n;

/**
 * Deployed perp contract addresses.
 *
 * Populated from the environment, which `scripts/demo-seed.ts` prints after it
 * runs. Empty strings mean "not deployed yet" — the UI must treat that as a
 * hard error rather than falling back to mock data, so a misconfigured deploy
 * fails loudly instead of showing numbers that are not on chain.
 */
export const PERP_ADDRESSES = {
  usdc: (process.env.NEXT_PUBLIC_PERP_USDC || "") as `0x${string}`,
  oracle: (process.env.NEXT_PUBLIC_PERP_ORACLE || "") as `0x${string}`,
  vault: (process.env.NEXT_PUBLIC_PERP_VAULT || "") as `0x${string}`,
  positionManager: (process.env.NEXT_PUBLIC_PERP_POSITION_MANAGER || "") as `0x${string}`,
} as const;

/** True once every perp address is configured. */
export const PERP_IS_CONFIGURED =
  PERP_ADDRESSES.usdc.length > 0 &&
  PERP_ADDRESSES.oracle.length > 0 &&
  PERP_ADDRESSES.vault.length > 0 &&
  PERP_ADDRESSES.positionManager.length > 0;

/** USDC has 6 decimals; all USD values in the contracts use 18. */
export const USDC_DECIMALS = 6;
export const USD_DECIMALS = 18;

/**
 * Pyth feed ids used by the perp module.
 *
 * ⚠️ These are NOT usable on Monad Testnet today. Read this before wiring them
 * to `PythOracleAdapter`.
 *
 * The `Index` variants are 24/7 in Pyth's off-chain metadata — outside market
 * hours they follow a defined methodology rather than the last exchange print.
 * That metadata is what made them look like the right choice, and it is
 * misleading: Pyth lists feeds it has not deployed to every chain. Probed
 * directly on Monad (`cast call <pyth> "priceFeedExists(bytes32)(bool)"`):
 *
 *   Equity.Index.NVDA/USD  -> false   absent on Monad
 *   Equity.Index.TSLA/USD  -> false   absent on Monad
 *   Equity.US.NVDA/USD     -> true    present, but 143 days stale
 *   Crypto.BTC/USD         -> true    live
 *   Crypto.ETH/USD         -> true    live
 *
 * So equity feeds are unusable on this chain and only the crypto feeds work.
 * The full probe and its lesson are in `docs/执行方案-后端与合约.md` §0.2.
 *
 * These ids are still what the module uses, because `DemoOracle` treats a feed
 * id as an opaque key — it is seeded with whatever id the caller passes, so the
 * demo works regardless of whether Pyth has the feed. That is the point of the
 * `IPriceOracle` abstraction: the demo path and the production path share an
 * interface, not a dependency.
 *
 * Verify with `priceFeedExists` on the target chain before pointing a real
 * oracle at any id here. Do not trust Hermes metadata for availability.
 */
export const FEEDS = {
  /** Equity.Index.NVDA/USD — 24/7 per Pyth metadata, but ABSENT on Monad. */
  NVDA: "0xa470c4ac46f44b547b2cba52338f311fb642b79375ce5f0cfd5cb5b99227b852",
  /** Equity.Index.TSLA/USD — 24/7 per Pyth metadata, but ABSENT on Monad. */
  TSLA: "0xe6da44bff5b8b06897a3739dd331b440d6662595bb862e37046892c568ae3fc0",
  /** Crypto.BTC/USD — 24/7 AND present on Monad. The only usable real feed. */
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
} as const;

/** Session-only `Equity.US.*` feeds, kept for reference / comparison in the demo. */
export const SESSION_FEEDS = {
  NVDA: "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593",
  TSLA: "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
} as const;

export type FeedSymbol = keyof typeof FEEDS;

export const FEED_SYMBOLS = Object.keys(FEEDS) as FeedSymbol[];
