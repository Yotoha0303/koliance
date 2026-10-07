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

    /// @notice Sum of collateral across open positions, 18-decimal USD.
    /// @dev This is what {Vault} reserves against — see `reservedAssets`.
    uint256 public openCollateralUsd;

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

    event PriceUpdaterSet(address indexed priceUpdater);

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

        // Collateral moves straight to the Vault — this contract never holds funds.
        if (!collateralToken.transferFrom(msg.sender, address(vault), collateralAmount)) {
            revert InsufficientCollateral();
        }

        uint256 grossUsd = collateralAmount * usdcToUsdScale;
        uint256 feeUsd = (grossUsd * PerpConstants.OPEN_FEE_BPS) / PerpConstants.BPS_DENOMINATOR;
        uint256 collateralUsd = grossUsd - feeUsd;

        positionId = ++nextPositionId;
        uint256 sizeUsd = (collateralUsd * leverageBps) / PerpConstants.BPS_DENOMINATOR;

        _positions[positionId] = Position({
            owner: msg.sender,
            feedId: feedId,
            collateralUsd: collateralUsd,
            sizeUsd: sizeUsd,
            entryPrice: price,
            isLong: isLong,
            openedAt: block.timestamp
        });
        isOpen[positionId] = true;
        openCollateralUsd += collateralUsd;

        // The fee is already sitting in the Vault (it was part of the transfer);
        // this records it so the indexer can attribute it.
        vault.receiveFees(feeUsd);

        emit PositionOpened(positionId, msg.sender, feedId, collateralUsd, sizeUsd, price, isLong);
    }

    // ==================== CLOSE ====================

    /// @inheritdoc IPositionManager
    function closePosition(uint256 positionId, bytes[] calldata pythUpdateData) external {
        Position memory p = _requireOpen(positionId);
        if (p.owner != msg.sender) revert NotPositionOwner(positionId, msg.sender);

        _pushPrices(pythUpdateData);

        (uint256 exitPrice, ) = oracle.getPrice(p.feedId);
        int256 pnl = _pnl(p, exitPrice);

        uint256 equity;
        if (pnl >= 0) {
            equity = p.collateralUsd + pnl.toUint256();
        } else {
            uint256 loss = (-pnl).toUint256();
            // Loss is capped at collateral: a position cannot owe more than it
            // posted. Without this the subtraction would underflow and the trader
            // would be stuck in a position they cannot exit.
            equity = loss >= p.collateralUsd ? 0 : p.collateralUsd - loss;
        }

        equity = _applyCloseFee(equity);

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

            int256 pnl = _pnl(p, exitPrice);
            uint256 equity = _equityAfter(p, pnl);

            uint256 reward = (equity * PerpConstants.LIQUIDATOR_REWARD_BPS) /
                PerpConstants.BPS_DENOMINATOR;

            _close(positionId, p);

            if (reward > 0) {
                vault.payOut(msg.sender, reward);
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
    /// @dev Reports open collateral rather than collateral + potential profit.
    ///      Profit is unbounded, so including it would make the reserve meaningless.
    ///      Open collateral is the honest floor on what could be owed back.
    function reservedAssets() external view returns (uint256) {
        return openCollateralUsd;
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
        openCollateralUsd -= p.collateralUsd;
        delete _positions[positionId];
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
