// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

/// @title PerpConstants
/// @notice Canonical values for everything the CONTRACTS themselves consume at
/// compile time (fee splits, margin thresholds, leverage bounds).
///
/// Solidity cannot import the TypeScript config, so there has to be a Solidity-side
/// definition. This is it. `src/lib/perpConfig.ts` carries mirror values for the
/// off-chain side and MUST be reconciled against the `IPositionManager` getters on
/// load — those getters read back what was actually deployed, which is the only
/// thing that cannot go stale.
///
/// The split by consumer is deliberate:
///   - on-chain-consumed values  -> defined here, mirrored in TS
///   - off-chain-only values     -> defined in TS (e.g. Pyth feed ids, which are
///                                  passed into the contracts as arguments and
///                                  never need to be hardcoded on chain)
library PerpConstants {
    /// Basis-point denominator.
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    /// 0.1% charged on open, deducted from collateral and paid into the Vault.
    uint256 internal constant OPEN_FEE_BPS = 10;

    /// 0.1% charged on close.
    uint256 internal constant CLOSE_FEE_BPS = 10;

    /// 1% maintenance margin.
    uint256 internal constant MAINTENANCE_MARGIN_BPS = 100;

    /// 5% of the position's collateral paid to the liquidator.
    /// @dev Based on COLLATERAL, not on remaining equity. Paying 5% of equity
    ///      meant a bankrupt position (equity == 0) paid nothing, which inverts
    ///      the incentive: the positions most in need of liquidation were the
    ///      ones no rational bot would touch. At liquidation `equity` is always
    ///      below `collateral` (maintenance margin is 1% of size while collateral
    ///      is at least 2% of size), so this base is strictly larger and is never
    ///      zero for a real position.
    uint256 internal constant LIQUIDATOR_REWARD_BPS = 500;

    /// Profit ceiling, in basis points of notional size.
    ///
    /// A position's payout is capped at `collateral + size * MAX_PROFIT_BPS / 1e4`,
    /// fixed at open time and reported from there on. This is what makes the
    /// pool's liability a finite, computable number instead of an unbounded one.
    ///
    /// Without it `Vault.payOut` reverts whenever profit exceeds the pool, and
    /// because the revert rolls back `_close` the position becomes permanently
    /// un-closeable with its margin stranded. Capping is the fix; see ADR-002.
    ///
    /// 10_000 = profit capped at 100% of notional (a 10x position can at most
    /// return 11x its collateral). Raising it widens the liability the pool must
    /// carry, and the open-time capacity gate widens with it.
    uint256 internal constant MAX_PROFIT_BPS = 10_000;

    /// 50x ceiling.
    uint256 internal constant MAX_LEVERAGE_BPS = 500_000;

    /// 1x floor.
    uint256 internal constant MIN_LEVERAGE_BPS = 10_000;

    /// USD values are 18-decimal internally.
    uint256 internal constant USD_DECIMALS = 18;

    /// USDC is 6-decimal; conversions between the two live in the Vault.
    uint256 internal constant USDC_DECIMALS = 6;

    /// Fixed-point denominator for WAD maths (the funding index and skew).
    int256 internal constant WAD = 1e18;

    /// Funding accrued per block, in WAD index units, at FULL skew.
    ///
    /// The actual per-block delta is this scaled by the skew fraction, so a
    /// balanced book accrues nothing and a fully one-sided book accrues this.
    ///
    /// Why per BLOCK rather than the usual 8-hourly rate: this is the mechanism
    /// that a fast chain makes possible and a slow one does not. Funding that
    /// settles every block keeps the perp pinned to spot far more tightly than
    /// an 8-hourly rate, because the arbitrage that closes a basis has 28,800
    /// fewer blocks to wait for.
    ///
    /// This is a DEFAULT, not a hard constant — `PositionManager` copies it into
    /// a state variable at construction and the owner may retune it within
    /// `MAX_FUNDING_RATE_PER_BLOCK_WAD`. The reason is arithmetic, not
    /// convenience:
    ///
    ///   1e11 per block is ~0.86%/day at full skew, which is realistic. On a
    ///   9,990 USD position that is 0.001 USD per block — correct, and utterly
    ///   invisible in a demo that lasts a few hundred blocks.
    ///
    /// A rate you cannot see move is not demonstrable, and a rate high enough to
    /// see over 100 blocks is not realistic. Rather than pick one and pretend,
    /// the rate is a parameter: the default is the realistic figure, and a demo
    /// deployment raises it. See ADR-003.
    int256 internal constant DEFAULT_FUNDING_RATE_PER_BLOCK_WAD = 1e11;

    /// Ceiling on the owner-settable funding rate, WAD per block.
    ///
    /// 1e13 is 1e-5 of notional per block at full skew, i.e. ~86%/day. That is
    /// already absurdly aggressive for a real venue; the cap exists so a
    /// compromised or careless owner cannot set a rate that transfers a
    /// position's entire collateral in a handful of blocks. Governance should
    /// tighten this, not loosen it.
    int256 internal constant MAX_FUNDING_RATE_PER_BLOCK_WAD = 1e13;
}
