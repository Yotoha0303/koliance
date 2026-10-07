// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

import {IPositionManager} from "./interfaces/IPositionManager.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {IVault} from "./interfaces/IVault.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {Ownable} from "./utils/Ownable.sol";
import {SafeCast} from "./utils/SafeCast.sol";
import {PerpConstants} from "./PerpConstants.sol";

/// @title PositionManager
/// @notice Opens, closes, and liquidates leveraged positions against {Vault}.
///
/// Collateral flows into the Vault on open and is paid back out of it on close —
/// the Vault is the counterparty, not this contract. So this contract holds no
/// funds of its own; it only decides who is owed what.
///
/// Units: all USD amounts here are 18-decimal. Collateral arrives as 6-decimal
/// USDC and is scaled on the way in.
///
/// Batch liquidation is the demo centrepiece. Two details make it correct rather
/// than merely fast:
///
///   1. All positions in one call are valued against a SINGLE price snapshot.
///      Reading the oracle inside the loop would let the first liquidation shift
///      the basis for the rest.
///   2. Distinct feed ids are resolved once, not once per position, so a batch of
///      20 positions across 3 feeds makes 3 oracle reads, not 20.
contract PositionManager is IPositionManager, Ownable {
    using SafeCast for uint256;
    using SafeCast for int256;

    /// @notice The pool that takes the other side of every trade.
    IVault public immutable vault;

    /// @notice Price source. DemoOracle for the demo, PythOracleAdapter for real feeds.
    IPriceOracle public immutable oracle;

    /// @notice Collateral token (USDC).
    IERC20 public immutable collateralToken;

    /// @notice 18/6 scale factor for USDC -> USD.
    uint256 public immutable usdcToUsdScale;

    /// @notice Positions by id. Ids start at 1; id 0 is never a valid position.
    mapping(uint256 => Position) internal _positions;

    /// @notice Set when a position is open; cleared when closed or liquidated.
    mapping(uint256 => bool) public isOpen;

    uint256 public nextPositionId;

    /// @notice Sum of `payoutCapUsd` across open positions, 18-decimal USD.
    /// @dev This is what {Vault} reserves against — see `reservedAssets`.
    ///      An O(1) accumulator rather than a sum over positions, because
    ///      `reservedAssets()` is called on every LP withdrawal and the number
    ///      of open positions has no bound.
    uint256 public totalPayoutCapUsd;

    /// @notice Optional price-push target, forwarded update data before reads.
    /// @dev `PythOracleAdapter` needs `updatePriceFeeds` called before `getPrice`,
    ///      while `DemoOracle` needs nothing. Rather than branch on the oracle type,
    ///      this is set to the adapter when one is in use and left zero otherwise.
    ///      Keeping it separate is what lets the frozen `bytes[] pythUpdateData`
    ///      parameter exist without coupling this contract to Pyth.
    address public priceUpdater;

    error ZeroAmount();
    error InvalidLeverage(uint256 leverageBps);
    error PositionNotOpen(uint256 positionId);
    error NotPositionOwner(uint256 positionId, address caller);
    error NotLiquidatable(uint256 positionId);
    error InsufficientCollateral();
    error InsufficientPoolCapacity(uint256 requiredUsd, uint256 availableUsd);

    event PriceUpdaterSet(address indexed priceUpdater);

    /// @notice Emitted when a single position's bounty cannot be paid during a
    ///         batch liquidation. The position is still closed; only the bounty
    ///         is skipped. See `liquidate` for why this is not a revert.
    event PositionRewardFailed(uint256 indexed positionId, uint256 rewardUsd);

    constructor(
        address vault_,
        address oracle_,
        address collateralToken_,
        address owner_
    ) Ownable() {
        if (vault_ == address(0) || oracle_ == address(0) || collateralToken_ == address(0)) {
            revert ZeroAddress();
        }

        vault = IVault(vault_);
        oracle = IPriceOracle(oracle_);
        collateralToken = IERC20(collateralToken_);

        uint8 dec = IERC20(collateralToken_).decimals();
        usdcToUsdScale = 10 ** (PerpConstants.USD_DECIMALS - dec);

        if (owner_ != msg.sender) {
            if (owner_ == address(0)) revert ZeroAddress();
            emit OwnershipTransferred(msg.sender, owner_);
            owner = owner_;
        }
    }

    // ==================== PARAMETERS ====================
    // Exposed so the frontend and the Go liquidator read what was actually
    // deployed rather than hardcoding the values from the config file.

    function openFeeBps() external pure returns (uint256) {
        return PerpConstants.OPEN_FEE_BPS;
    }

    function closeFeeBps() external pure returns (uint256) {
        return PerpConstants.CLOSE_FEE_BPS;
    }

    function maintenanceMarginBps() external pure returns (uint256) {
        return PerpConstants.MAINTENANCE_MARGIN_BPS;
    }

    function liquidatorRewardBps() external pure returns (uint256) {
        return PerpConstants.LIQUIDATOR_REWARD_BPS;
    }

    function maxLeverageBps() external pure returns (uint256) {
        return PerpConstants.MAX_LEVERAGE_BPS;
    }

    function maxProfitBps() external pure returns (uint256) {
        return PerpConstants.MAX_PROFIT_BPS;
    }

    // ==================== WIRING ====================

    function setPriceUpdater(address priceUpdater_) external onlyOwner {
        if (priceUpdater_ == address(0)) revert ZeroAddress();
        priceUpdater = priceUpdater_;
        emit PriceUpdaterSet(priceUpdater_);
    }

    // ==================== OPEN ====================

    /// @inheritdoc IPositionManager
    function openPosition(
        bytes32 feedId,
        uint256 collateralAmount,
        uint256 leverageBps,
        bool isLong,
        bytes[] calldata pythUpdateData
    ) external returns (uint256 positionId) {
        if (collateralAmount == 0) revert ZeroAmount();
        if (leverageBps < PerpConstants.MIN_LEVERAGE_BPS || leverageBps > PerpConstants.MAX_LEVERAGE_BPS) {
            revert InvalidLeverage(leverageBps);
        }

        _pushPrices(pythUpdateData);

        (uint256 price, ) = oracle.getPrice(feedId);
        if (price == 0) revert ZeroAmount();

        positionId = ++nextPositionId;

        // Collateral moves straight to the Vault — this contract never holds funds.
        if (!collateralToken.transferFrom(msg.sender, address(vault), collateralAmount)) {
            revert InsufficientCollateral();
        }

        uint256 collateralUsd = _netCollateralUsd(collateralAmount);
        uint256 sizeUsd = (collateralUsd * leverageBps) / PerpConstants.BPS_DENOMINATOR;

        // Payout cap: the most this position can ever be paid. Fixing it here is
        // what turns the pool's liability into a finite number the Vault can
        // reserve against, and it is why a payout can no longer revert.
        uint256 payoutCapUsd = _payoutCapUsd(collateralUsd, sizeUsd);

        _assertPoolCapacity(payoutCapUsd);

        _positions[positionId] = Position({
            owner: msg.sender,
            feedId: feedId,
            collateralUsd: collateralUsd,
            sizeUsd: sizeUsd,
            payoutCapUsd: payoutCapUsd,
            entryPrice: price,
            isLong: isLong,
            openedAt: block.timestamp
        });
        isOpen[positionId] = true;
        totalPayoutCapUsd += payoutCapUsd;

        // The fee is already sitting in the Vault (it was part of the transfer);
        // this records it so the indexer can attribute it.
        vault.receiveFees(collateralAmount * usdcToUsdScale - collateralUsd);

        emit PositionOpened(positionId, msg.sender, feedId, collateralUsd, sizeUsd, price, isLong);
    }

    // ==================== CLOSE ====================

    /// @inheritdoc IPositionManager
    /// @dev The payout is capped at `payoutCapUsd`, fixed at open. Two consequences
    ///      worth stating because both were bugs before:
    ///
    ///      1. A payout that would exceed the pool is capped rather than allowed
    ///         to revert. A revert here would roll back `_close` and strand the
    ///         position's margin with no way out.
    ///      2. A payout that truncates to zero USDC is SKIPPED, not attempted.
    ///         `Vault.payOut` rejects a zero-USDC payout, and for a position whose
    ///         equity is a few wei of USD the honest settlement is "you get
    ///         nothing" — not "you can never close".
    function closePosition(uint256 positionId, bytes[] calldata pythUpdateData) external {
        Position memory p = _requireOpen(positionId);
        if (p.owner != msg.sender) revert NotPositionOwner(positionId, msg.sender);

        _pushPrices(pythUpdateData);

        (uint256 exitPrice, ) = oracle.getPrice(p.feedId);
        int256 pnl = _pnl(p, exitPrice);

        uint256 equity = _equityAfter(p, pnl);

        // Cap profit at the value committed to at open.
        if (equity > p.payoutCapUsd) {
            equity = p.payoutCapUsd;
        }

        equity = _applyCloseFee(equity);
        equity = _payableUsd(equity);

        _close(positionId, p);

        if (equity > 0) {
            vault.payOut(p.owner, equity);
        }

        emit PositionClosed(positionId, p.owner, exitPrice, pnl);
    }

    // ==================== LIQUIDATE ====================

    /// @inheritdoc IPositionManager
    /// @dev Batch. Prices are snapshotted per distinct feed before the loop so the
    ///      ordering of liquidations cannot change any other position's verdict.
    function liquidate(uint256[] calldata positionIds, bytes[] calldata pythUpdateData) external {
        if (positionIds.length == 0) return;

        _pushPrices(pythUpdateData);

        // Pass 1: resolve each distinct feed once, and remember which slot in the
        // snapshot array each feed landed in.
        bytes32[] memory feeds = new bytes32[](positionIds.length);
        uint256[] memory prices = new uint256[](positionIds.length);
        uint256 feedCount = 0;

        for (uint256 i = 0; i < positionIds.length; i++) {
            if (!isOpen[positionIds[i]]) continue;

            bytes32 feedId = _positions[positionIds[i]].feedId;
            bool cached = false;
            for (uint256 j = 0; j < feedCount; j++) {
                if (feeds[j] == feedId) {
                    cached = true;
                    break;
                }
            }
            if (cached) continue;

            (uint256 price, ) = oracle.getPrice(feedId);
            feeds[feedCount] = feedId;
            prices[feedCount] = price;
            feedCount++;
        }

        // Pass 2: act, reading only from the snapshot taken above.
        for (uint256 i = 0; i < positionIds.length; i++) {
            uint256 positionId = positionIds[i];
            if (!isOpen[positionId]) continue;

            Position memory p = _positions[positionId];
            uint256 exitPrice = 0;
            for (uint256 j = 0; j < feedCount; j++) {
                if (feeds[j] == p.feedId) {
                    exitPrice = prices[j];
                    break;
                }
            }

            if (!_isLiquidatable(p, exitPrice)) continue;

            // Bounty is a share of COLLATERAL, not of remaining equity. Equity
            // can be zero (bankrupt position) and paying 5% of zero paid nothing,
            // which left the worst positions with no liquidator incentive at all.
            uint256 reward = (p.collateralUsd * PerpConstants.LIQUIDATOR_REWARD_BPS) /
                PerpConstants.BPS_DENOMINATOR;

            _close(positionId, p);

            // Per-position fault isolation. The position is already closed above,
            // so a failure to pay the bounty must not undo the liquidation — and
            // must not take the rest of the batch down with it. Batch liquidation
            // is the whole point of this function, so one unpayable bounty
            // degrading to a skipped bounty is the correct trade.
            if (reward > 0) {
                try vault.payOut(msg.sender, reward) {}
                catch {
                    emit PositionRewardFailed(positionId, reward);
                }
            }

            emit PositionLiquidated(positionId, p.owner, msg.sender, exitPrice, reward);
        }
    }

    // ==================== VIEWS ====================

    /// @inheritdoc IPositionManager
    function getPosition(uint256 positionId) external view returns (Position memory) {
        return _positions[positionId];
    }

    /// @inheritdoc IPositionManager
    function isLiquidatable(uint256 positionId) external view returns (bool) {
        if (!isOpen[positionId]) return false;
        Position memory p = _positions[positionId];
        (uint256 price, ) = oracle.getPrice(p.feedId);
        return _isLiquidatable(p, price);
    }

    /// @inheritdoc IPositionManager
    /// @dev Reports the sum of each open position's payout cap, not the sum of
    ///      open collateral.
    ///
    ///      Open collateral is only a LOWER bound on the obligation: it is exact
    ///      for a position that is losing and short for one that is winning. The
    ///      gap is what let an LP withdraw to `collateral` and leave a profitable
    ///      trader unpaid. Because profit is capped at `MAX_PROFIT_BPS`, the cap
    ///      is both an upper bound and a finite number, so reserving it is
    ///      conservative without being unbounded.
    ///
    ///      Invariant maintained by `openPosition`: after every operation
    ///      `vault.totalAssets() >= reservedAssets()`.
    function reservedAssets() external view returns (uint256) {
        return totalPayoutCapUsd;
    }

    /// @notice Unrealised PnL for a position at the current oracle price.
    function unrealizedPnl(uint256 positionId) external view returns (int256) {
        if (!isOpen[positionId]) return 0;
        Position memory p = _positions[positionId];
        (uint256 price, ) = oracle.getPrice(p.feedId);
        return _pnl(p, price);
    }

    // ==================== INTERNAL ====================

    function _pushPrices(bytes[] calldata pythUpdateData) internal {
        if (priceUpdater == address(0) || pythUpdateData.length == 0) return;
        // Best-effort: a stale or already-applied update must not block a close or
        // a liquidation. The staleness check that matters is `getPrice`'s own.
        (bool ok, ) = priceUpdater.call(
            abi.encodeWithSignature("updatePriceFeeds(bytes[])", pythUpdateData)
        );
        ok; // deliberately ignored
    }

    function _requireOpen(uint256 positionId) internal view returns (Position memory p) {
        if (!isOpen[positionId]) revert PositionNotOpen(positionId);
        p = _positions[positionId];
    }

    function _close(uint256 positionId, Position memory p) internal {
        isOpen[positionId] = false;
        totalPayoutCapUsd -= p.payoutCapUsd;
        delete _positions[positionId];
    }

    /// @dev Collateral credited to the position, 18-decimal USD: the gross amount
    ///      scaled up from USDC, less the open fee. The fee itself already sits in
    ///      the Vault as part of the transfer.
    function _netCollateralUsd(uint256 collateralAmount) internal view returns (uint256) {
        uint256 grossUsd = collateralAmount * usdcToUsdScale;
        uint256 feeUsd = (grossUsd * PerpConstants.OPEN_FEE_BPS) / PerpConstants.BPS_DENOMINATOR;
        return grossUsd - feeUsd;
    }

    /// @dev The most this position can ever be paid out, 18-decimal USD.
    function _payoutCapUsd(uint256 collateralUsd, uint256 sizeUsd) internal pure returns (uint256) {
        return collateralUsd +
            (sizeUsd * PerpConstants.MAX_PROFIT_BPS) / PerpConstants.BPS_DENOMINATOR;
    }

    /// @dev Admission gate: the pool must be able to cover every open position's
    ///      payout cap after this one is added.
    ///
    ///      Checking here rather than at payout time is the whole design. A
    ///      position that could never be paid is refused at open instead of being
    ///      accepted and then bricking on close — the trader loses nothing, rather
    ///      than posting margin they can never recover.
    ///
    ///      The collateral has already been transferred to the Vault at this
    ///      point, so it is included in `totalAssets()` and counts toward cover.
    function _assertPoolCapacity(uint256 payoutCapUsd) internal view {
        uint256 projectedReserved = totalPayoutCapUsd + payoutCapUsd;
        uint256 projectedAssets = vault.totalAssets();
        if (projectedAssets < projectedReserved) {
            revert InsufficientPoolCapacity(projectedReserved, projectedAssets);
        }
    }

    /// @dev Rounds a USD amount down to the largest value `Vault.payOut` will
    ///      accept. The Vault rejects a payout that converts to zero USDC, so
    ///      anything below one USDC unit settles as zero rather than reverting.
    ///      Returning 0 is the caller's signal to skip the payout entirely.
    function _payableUsd(uint256 amountUsd) internal view returns (uint256) {
        return (amountUsd / usdcToUsdScale) * usdcToUsdScale;
    }

    function _applyCloseFee(uint256 equity) internal pure returns (uint256) {
        uint256 fee = (equity * PerpConstants.CLOSE_FEE_BPS) / PerpConstants.BPS_DENOMINATOR;
        return equity - fee;
    }

    /// @dev `pnl = size * (exit - entry) / entry`, inverted for shorts.
    function _pnl(Position memory p, uint256 exitPrice) internal pure returns (int256) {
        if (exitPrice == p.entryPrice) return 0;

        int256 size = p.sizeUsd.toInt256();
        int256 entry = p.entryPrice.toInt256();
        int256 exit = exitPrice.toInt256();

        return p.isLong
            ? (size * (exit - entry)) / entry
            : (size * (entry - exit)) / entry;
    }

    /// @dev Equity after PnL, floored at zero. A position can lose its collateral
    ///      but never more than that.
    function _equityAfter(Position memory p, int256 pnl) internal pure returns (uint256) {
        if (pnl >= 0) return p.collateralUsd + pnl.toUint256();
        uint256 loss = (-pnl).toUint256();
        return loss >= p.collateralUsd ? 0 : p.collateralUsd - loss;
    }

    /// @dev Must agree with `isLiquidatable` in src/lib/perp.ts. Both compute
    ///      `mm = size * MAINTENANCE_MARGIN_BPS / BPS_DENOMINATOR` and then compare
    ///      `equity <= mm`. Changing the order of those divisions in either place
    ///      desynchronises the UI's estimated liquidation price from reality.
    function _isLiquidatable(Position memory p, uint256 price) internal pure returns (bool) {
        int256 pnl = _pnl(p, price);
        uint256 equity = _equityAfter(p, pnl);
        uint256 mm = (p.sizeUsd * PerpConstants.MAINTENANCE_MARGIN_BPS) /
            PerpConstants.BPS_DENOMINATOR;
        return equity <= mm;
    }
}
