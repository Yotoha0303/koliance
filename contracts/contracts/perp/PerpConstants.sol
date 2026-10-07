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

    /// 5% of remaining collateral paid to the liquidator.
    uint256 internal constant LIQUIDATOR_REWARD_BPS = 500;

    /// 50x ceiling.
    uint256 internal constant MAX_LEVERAGE_BPS = 500_000;

    /// 1x floor.
    uint256 internal constant MIN_LEVERAGE_BPS = 10_000;

    /// USD values are 18-decimal internally.
    uint256 internal constant USD_DECIMALS = 18;

    /// USDC is 6-decimal; conversions between the two live in the Vault.
    uint256 internal constant USDC_DECIMALS = 6;
}
