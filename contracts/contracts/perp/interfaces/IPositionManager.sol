// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

/// @title IPositionManager
/// @notice Open / close / liquidate leveraged positions against the Vault.
///
/// The liquidation path is the demo centrepiece. `liquidate` takes an array of
/// position ids so the off-chain Go bot can clear dozens of positions inside a
/// single Monad block.
interface IPositionManager {
    struct Position {
        address owner;
        bytes32 feedId;
        uint256 collateralUsd; // 18 decimals
        uint256 sizeUsd;       // collateralUsd * leverageBps / 1e4
        /// Upper bound on what this position can ever be paid out, 18 decimals.
        /// Fixed at open as `collateralUsd + sizeUsd * MAX_PROFIT_BPS / 1e4`.
        /// Summed into `reservedAssets()`, so the Vault can always cover it.
        uint256 payoutCapUsd;
        uint256 entryPrice;    // 18 decimals
        bool    isLong;
        uint256 openedAt;
    }

    // Frozen event signatures — the Go indexer backfills from these logs.
    event PositionOpened(
        uint256 indexed positionId,
        address indexed owner,
        bytes32 indexed feedId,
        uint256 collateralUsd,
        uint256 sizeUsd,
        uint256 entryPrice,
        bool    isLong
    );
    event PositionClosed(
        uint256 indexed positionId,
        address indexed owner,
        uint256 exitPrice,
        int256  pnl
    );
    event PositionLiquidated(
        uint256 indexed positionId,
        address indexed owner,
        address indexed liquidator,
        uint256 exitPrice,
        uint256 reward
    );

    /// @param leverageBps leverage in basis points (1x = 10000, 50x = 500000)
    function openPosition(
        bytes32          feedId,
        uint256          collateralAmount,
        uint256          leverageBps,
        bool             isLong,
        bytes[] calldata pythUpdateData
    ) external returns (uint256 positionId);

    function closePosition(uint256 positionId, bytes[] calldata pythUpdateData) external;

    /// @notice Batch liquidation.
    ///
    /// All positions in one call MUST be valued against a single price snapshot.
    /// Implementations should resolve each distinct feedId once, cache it, and
    /// reuse that price for every position in the loop — otherwise the first
    /// liquidation mutates state and shifts the basis for the rest.
    function liquidate(uint256[] calldata positionIds, bytes[] calldata pythUpdateData) external;

    function getPosition(uint256 positionId) external view returns (Position memory);

    function isLiquidatable(uint256 positionId) external view returns (bool);

    function nextPositionId() external view returns (uint256);

    // ==================== FROZEN PARAMETERS ====================
    //
    // The deployment is the authoritative source for these values. The frontend's
    // `src/lib/perpConfig.ts` mirrors them for SSR and pre-connect rendering, and
    // MUST be reconciled against these getters on load — if they diverge, the UI's
    // estimated liquidation price will not match what the contract actually does.
    // The Go liquidator also reads these at startup rather than hardcoding.

    function openFeeBps() external view returns (uint256);
    function closeFeeBps() external view returns (uint256);
    function maintenanceMarginBps() external view returns (uint256);
    function liquidatorRewardBps() external view returns (uint256);
    function maxLeverageBps() external view returns (uint256);

    /// @notice Profit ceiling as basis points of notional size.
    /// @dev A position's payout never exceeds `collateral + size * this / 1e4`.
    function maxProfitBps() external view returns (uint256);

    /// @notice 18-decimal USD the Vault must keep in reserve to honour open positions.
    ///
    /// Without this, LPs could withdraw the collateral backing live positions and
    /// winning traders would have nothing to be paid from. `Vault.removeLiquidity`
    /// subtracts this from available assets before allowing a withdrawal.
    ///
    /// This is the SUM OF EACH OPEN POSITION'S PAYOUT CAP, not the sum of open
    /// collateral. Collateral alone is only a lower bound on the obligation (it
    /// is exact for a losing position and short for a winning one), and the gap
    /// is exactly what let an LP drain a pool out from under a profitable trader.
    /// Because the cap is finite, this value is both conservative and O(1).
    ///
    /// Invariant: `Vault.totalAssets() >= reservedAssets()` after every
    /// operation. `openPosition` enforces it at admission, which is what makes
    /// payouts unable to revert for insufficient liquidity.
    function reservedAssets() external view returns (uint256);
}
