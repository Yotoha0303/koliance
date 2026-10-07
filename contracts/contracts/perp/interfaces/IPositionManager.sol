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
        /// Cumulative funding index for this feed at the moment of opening.
        /// Funding owed is `size * (indexNow - entryFundingIndex) / WAD`, which
        /// is why the index is stored rather than an accrued amount: it makes
        /// settlement O(1) and independent of how many blocks elapsed.
        int256  entryFundingIndex;
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

    /// @notice Emitted whenever a feed's cumulative funding index advances.
    /// @dev Carries the block number so a watcher can prove the index moved once
    ///      per block rather than in one jump — that per-block granularity is the
    ///      property worth demonstrating.
    event FundingAccrued(
        bytes32 indexed feedId,
        int256  index,
        uint256 blockNumber,
        int256  skewWad
    );

    /// @notice Emitted when a position settles its accrued funding.
    /// @param amount positive means the trader PAID, negative means they received.
    event FundingSettled(uint256 indexed positionId, int256 amount);

    /// @param leverageBps leverage in basis points (1x = 10000, 50x = 500000)
    function openPosition(
        bytes32          feedId,
        uint256          collateralAmount,
        uint256          leverageBps,
        bool             isLong,
        bytes[] calldata pythUpdateData
    ) external returns (uint256 positionId);

    /// @notice Close a position and receive its remaining equity.
    ///
    /// ⚠️ **This signature is a change to a previously frozen interface.**
    ///
    /// `推进方案.md:40` froze `closePosition(uint256, bytes[])` so the frontend
    /// and the (then unstarted) Go bot could be built against it in parallel.
    /// `minOutUsd` and `deadline` were added by GAP-07. Nothing outside this repo
    /// consumed the old form — the perp module has never been deployed — so the
    /// cost is the call sites in this repo, which are updated in the same change.
    ///
    /// **If you are building a consumer, expect this to move again**: the module
    /// is pre-deployment and the interface has not been re-frozen.
    ///
    /// @param minOutUsd floor on what the trader receives, 18-decimal USD. The
    ///        exit price is whatever the oracle reports when the transaction
    ///        lands, and on the Pyth path it comes from caller-supplied
    ///        `pythUpdateData` — so without a floor a close can be held and
    ///        included against a worse print than the one that was simulated.
    ///        Pass 0 to accept any price.
    /// @param deadline unix seconds after which the close reverts. Pass 0 to
    ///        disable. Guards the same exposure from the other side: a stale
    ///        transaction that lands much later than intended.
    /// @param pythUpdateData signed price updates, ignored when no price updater
    ///        is wired (the DemoOracle path).
    function closePosition(
        uint256          positionId,
        uint256          minOutUsd,
        uint256          deadline,
        bytes[] calldata pythUpdateData
    ) external;

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

    // ==================== FUNDING ====================
    //
    // Funding is what keeps a perpetual tethered to spot. Without it a perp is
    // just a leveraged bet whose price can drift arbitrarily far from the index;
    // with it, the crowded side pays the thin side until the basis closes.
    //
    // This implementation accrues PER BLOCK. Conventional venues settle funding
    // every 1–8 hours, which on a fast chain is an unnecessary compromise: the
    // arbitrage that closes a basis is bounded by how often funding can be
    // collected, so settling every block lets the perp track spot far more
    // tightly. That is the mechanism a high-throughput chain makes possible and
    // a slow one cannot copy — see ADR-003.

    /// @notice Cumulative funding index for a feed, WAD-scaled, signed.
    ///
    /// Interpretation: a position's funding owed is
    /// `sizeUsd * (indexNow - position.entryFundingIndex) / WAD`, where a
    /// POSITIVE result means the trader pays and a negative one means they are
    /// paid. Longs pay when the index rises.
    ///
    /// The index only ever moves forward in the direction of the skew, and is
    /// monotonic between accruals because each accrual adds a signed delta.
    function cumulativeFundingIndex(bytes32 feedId) external view returns (int256);

    /// @notice Funding accrued per block at full skew, WAD-scaled.
    function fundingRatePerBlockWad() external view returns (int256);

    /// @notice Accrue funding for a feed up to the current block.
    ///
    /// Public and permissionless: anyone may call it, and every state-changing
    /// entry point calls it internally first. That is what makes "per block"
    /// real — the index advances on whichever transaction comes first in a
    /// block, so a chain that produces blocks faster accrues funding faster.
    ///
    /// Returns the index after accrual.
    function accrueFunding(bytes32 feedId) external returns (int256);

    /// @notice Funding a position would owe right now, positive meaning it pays.
    /// @dev Does NOT accrue. Read-only, so it can be called from the UI or a bot
    ///      without spending gas, at the cost of being stale by the current
    ///      block's un-accrued delta.
    function fundingOwed(uint256 positionId) external view returns (int256);

    /// @notice Open interest on a feed, 18-decimal USD notional.
    function openInterest(bytes32 feedId) external view returns (uint256 longUsd, uint256 shortUsd);

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
