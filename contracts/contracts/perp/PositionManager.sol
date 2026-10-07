// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

import {IPositionManager} from "./interfaces/IPositionManager.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {IPyth} from "./interfaces/IPyth.sol";
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

    // ==================== FUNDING STATE ====================
    //
    // Funding is accrued lazily: the index advances on whichever transaction
    // touches a feed first in a block, and every state-changing entry point
    // accrues before it reads. No keeper, no timer, no cron — the chain's own
    // block production is the clock. See `accrueFunding`.

    /// @notice Cumulative funding index per feed, WAD-scaled, signed.
    /// @dev A trader's funding owed is `size * (index - entryFundingIndex) / WAD`.
    ///      Positive means the trader pays. Longs pay when this rises.
    mapping(bytes32 => int256) public cumulativeFundingIndex;

    /// @notice Last block in which a feed's funding was accrued. Zero means never.
    mapping(bytes32 => uint256) public lastFundingBlock;

    /// @notice Funding accrued per block at full skew, WAD-scaled.
    /// @dev Seeded from `PerpConstants.DEFAULT_FUNDING_RATE_PER_BLOCK_WAD` and
    ///      retunable by the owner up to `MAX_FUNDING_RATE_PER_BLOCK_WAD`.
    ///      Mutable because the realistic rate is invisible over a demo-length
    ///      run; see the constant's comment and ADR-003.
    int256 public fundingRatePerBlockWad;

    /// @notice Open interest per feed, 18-decimal USD notional.
    /// @dev Drives the skew. Maintained as O(1) accumulators on open and close,
    ///      because `accrueFunding` runs inside every entry point and cannot
    ///      afford to walk the position set.
    mapping(bytes32 => uint256) public longOpenInterestUsd;
    mapping(bytes32 => uint256) public shortOpenInterestUsd;

    error ZeroAmount();
    error InvalidLeverage(uint256 leverageBps);
    error PositionNotOpen(uint256 positionId);
    error NotPositionOwner(uint256 positionId, address caller);
    error NotLiquidatable(uint256 positionId);
    error InsufficientCollateral();
    error InsufficientPoolCapacity(uint256 requiredUsd, uint256 availableUsd);
    error InvalidFundingRate(int256 rate);

    /// @notice `closePosition` was called after its deadline.
    error DeadlinePassed(uint256 deadline);
    /// @notice The payout came out below the caller's floor.
    error InsufficientOutput(uint256 payoutUsd, uint256 minOutUsd);

    event PriceUpdaterSet(address indexed priceUpdater);

    /// @notice The per-block funding rate was set.
    event FundingRateSet(int256 ratePerBlockWad);

    /// @notice A best-effort price push succeeded.
    /// @dev Named distinctly from `PythOracleAdapter.PricePushed` so the two are
    ///      not confused when reading logs: this one says the manager forwarded
    ///      an update, that one says Pyth accepted it. Worth emitting even on
    ///      success — it is the only positive evidence that the oracle's own
    ///      staleness window is being refreshed rather than quietly elapsing.
    event PricePushSucceeded(address indexed updater, uint256 updateCount);

    /// @notice A best-effort price push failed and was swallowed.
    /// @dev The trade still proceeds; this is the signal that it proceeded on a
    ///      price nobody refreshed. Silence here was the old behaviour.
    event PricePushFailed(address indexed updater, uint256 updateCount);

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

        fundingRatePerBlockWad = PerpConstants.DEFAULT_FUNDING_RATE_PER_BLOCK_WAD;
        emit FundingRateSet(fundingRatePerBlockWad);

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

    // ==================== FUNDING ====================

    /// @inheritdoc IPositionManager
    /// @dev Lazily advances the index to the current block. Idempotent within a
    ///      block: a second call in the same block finds `elapsed == 0` and does
    ///      nothing, so calling it from every entry point costs one SLOAD in the
    ///      common case and never double-charges.
    ///
    ///      This is what makes funding "per block" rather than "per hour": the
    ///      index advances once for each block that contains at least one
    ///      transaction touching the feed, and the size of the step is
    ///      proportional to the blocks elapsed.
    function accrueFunding(bytes32 feedId) public returns (int256) {
        uint256 last = lastFundingBlock[feedId];
        if (last == block.number) return cumulativeFundingIndex[feedId];

        int256 delta = 0;
        int256 skewWad = 0;

        // First accrual for a feed only seeds the clock. Accruing from block 0
        // would multiply the rate by the whole chain height.
        if (last != 0) {
            uint256 elapsed = block.number - last;
            (int256 fundingDelta, int256 skew) = _fundingDelta(feedId, elapsed);
            delta = fundingDelta;
            skewWad = skew;
            cumulativeFundingIndex[feedId] += delta;
        }

        lastFundingBlock[feedId] = block.number;
        emit FundingAccrued(feedId, cumulativeFundingIndex[feedId], block.number, skewWad);
        return cumulativeFundingIndex[feedId];
    }

    /// @inheritdoc IPositionManager
    /// @dev Projects the index to the current block rather than reading the
    ///      stored one. Reading storage would report zero until somebody called
    ///      `accrueFunding`, which makes the view useless for exactly the
    ///      consumer it exists for: a bot deciding whether a position is about
    ///      to become liquidatable. Mirrors `_isLiquidatable`'s projection so the
    ///      two never disagree.
    function fundingOwed(uint256 positionId) external view returns (int256) {
        Position memory p = _positions[positionId];
        return _fundingFor(p, _projectedFundingIndex(p.feedId));
    }

    /// @inheritdoc IPositionManager
    function openInterest(bytes32 feedId) external view returns (uint256 longUsd, uint256 shortUsd) {
        return (longOpenInterestUsd[feedId], shortOpenInterestUsd[feedId]);
    }

    /// @notice Signed skew of a feed in WAD, in [-WAD, WAD].
    ///
    /// Positive means longs dominate and therefore pay; zero means the book is
    /// balanced and funding is zero. Returned separately from the accrual so the
    /// frontend can display the current rate without a second implementation.
    function fundingSkewWad(bytes32 feedId) external view returns (int256) {
        return _skewWad(feedId);
    }

    // ==================== WIRING ====================

    function setPriceUpdater(address priceUpdater_) external onlyOwner {
        if (priceUpdater_ == address(0)) revert ZeroAddress();
        priceUpdater = priceUpdater_;
        emit PriceUpdaterSet(priceUpdater_);
    }

    /// @notice Retune the per-block funding rate, bounded by the constant ceiling.
    ///
    /// @dev The realistic default (1e11) moves a 9,990 USD position by 0.001 USD
    ///      per block — correct, and invisible in a demo. This exists so a demo
    ///      deployment can raise it to something a 100-block run can show,
    ///      WITHOUT changing the mechanism. The cap is what stops that escape
    ///      hatch from becoming a way to strip collateral in a few blocks.
    ///
    ///      Changing the rate does not retroactively re-price accrued funding:
    ///      the index is already banked, and only future blocks accrue at the
    ///      new rate. That is the conservative behaviour.
    function setFundingRatePerBlockWad(int256 rate) external onlyOwner {
        if (rate < 0) revert InvalidFundingRate(rate);
        if (rate > PerpConstants.MAX_FUNDING_RATE_PER_BLOCK_WAD) {
            revert InvalidFundingRate(rate);
        }
        fundingRatePerBlockWad = rate;
        emit FundingRateSet(rate);
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

        // Accrue before reading the index we are about to store. Skipping this
        // would let a position open against a stale index and immediately owe
        // (or be owed) the whole gap since the last accrual.
        int256 indexAtOpen = accrueFunding(feedId);

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
            openedAt: block.timestamp,
            entryFundingIndex: indexAtOpen
        });
        isOpen[positionId] = true;
        totalPayoutCapUsd += payoutCapUsd;

        // This position's notional now counts toward the feed's skew, which is
        // what the next accrual will charge against.
        if (isLong) {
            longOpenInterestUsd[feedId] += sizeUsd;
        } else {
            shortOpenInterestUsd[feedId] += sizeUsd;
        }

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
    ///
    ///      `minOutUsd` and `deadline` exist because the exit price is whatever
    ///      the oracle reports when the transaction lands, and on the Pyth path
    ///      that price is chosen by the `pythUpdateData` the caller supplies. That
    ///      is a real exposure on a public mempool: a close can be held and
    ///      included against a worse print than the one the trader simulated.
    ///      Both checks happen BEFORE any state changes, so a rejected close
    ///      leaves the position open and untouched rather than half-settled.
    function closePosition(
        uint256 positionId,
        uint256 minOutUsd,
        uint256 deadline,
        bytes[] calldata pythUpdateData
    ) external {
        if (deadline != 0 && block.timestamp > deadline) revert DeadlinePassed(deadline);

        Position memory p = _requireOpen(positionId);
        if (p.owner != msg.sender) revert NotPositionOwner(positionId, msg.sender);

        _pushPrices(pythUpdateData);

        // Accrue first so funding is charged for the blocks this position was
        // open, including the current one.
        int256 indexNow = accrueFunding(p.feedId);

        (uint256 exitPrice, ) = oracle.getPrice(p.feedId);
        int256 pnl = _pnl(p, exitPrice);
        int256 funding = _fundingFor(p, indexNow);

        // Funding is subtracted from equity: positive funding means the trader
        // pays. The floor at zero comes after, so a crowded side can be pushed
        // through its margin by the cost of carry alone.
        uint256 equity = _clampToZero(p.collateralUsd.toInt256() + pnl - funding).toUint256();

        // Cap profit at the value committed to at open.
        if (equity > p.payoutCapUsd) {
            equity = p.payoutCapUsd;
        }

        equity = _applyCloseFee(equity);
        equity = _payableUsd(equity);

        // Checked against the payable figure, because that is what the trader
        // actually receives. Comparing the pre-truncation number would let a
        // close through that pays less than the floor by up to one USDC unit.
        if (equity < minOutUsd) revert InsufficientOutput(equity, minOutUsd);

        _close(positionId, p);

        if (equity > 0) {
            vault.payOut(p.owner, equity);
        }

        emit FundingSettled(positionId, funding);
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

            // Accrue before snapshotting the price. Funding is part of the
            // liquidation verdict, so settling a position without first banking
            // the blocks it was open would charge it for the wrong interval.
            // Once per distinct feed, same as the price read.
            accrueFunding(feedId);

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

            // Funding is part of the verdict, so it must be part of the close
            // too — otherwise a position could be liquidated for funding and
            // then settle as if it owed none.
            int256 funding = _fundingFor(p, cumulativeFundingIndex[p.feedId]);

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

            emit FundingSettled(positionId, funding);
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
    /// @dev Excludes funding. Kept as-is because the UI shows the two separately:
    ///      a trader wants to see price PnL and cost of carry as distinct lines,
    ///      not one net figure that hides which is eating the margin.
    function unrealizedPnl(uint256 positionId) external view returns (int256) {
        if (!isOpen[positionId]) return 0;
        Position memory p = _positions[positionId];
        (uint256 price, ) = oracle.getPrice(p.feedId);
        return _pnl(p, price);
    }

    /// @notice Equity including both PnL and funding, floored at zero.
    /// @dev The figure `_isLiquidatable` actually compares. Exposed so the UI and
    ///      the Go liquidator can show the real margin rather than re-deriving it.
    ///
    ///      Named `positionEquity` rather than `equity` because the settlement
    ///      paths all have a local `equity`, and Solidity warns on the shadowing.
    function positionEquity(uint256 positionId) external view returns (int256) {
        if (!isOpen[positionId]) return 0;
        Position memory p = _positions[positionId];
        (uint256 price, ) = oracle.getPrice(p.feedId);
        return _equityAfterFunding(p, price, _projectedFundingIndex(p.feedId));
    }

    // ==================== INTERNAL ====================

    function _pushPrices(bytes[] calldata pythUpdateData) internal {
        address updater = priceUpdater;
        if (updater == address(0) || pythUpdateData.length == 0) return;

        // The `code.length` guard is load-bearing, not defensive theatre.
        //
        // A typed call to an address holding no code reverts with "function call
        // to a non-contract account", and — measured, not assumed — that revert
        // is NOT caught by the `try` below, because the code-existence check
        // happens before the call rather than inside it. Without this guard a
        // misconfigured `priceUpdater` (an EOA, a typo'd address) would revert
        // every close and every liquidation. That is GAP-01 arriving by a new
        // route: positions that cannot be closed.
        //
        // So a bad updater degrades to "the push is skipped and reported",
        // which is the behaviour the low-level call used to give us by accident.
        if (updater.code.length == 0) {
            emit PricePushFailed(updater, pythUpdateData.length);
            return;
        }

        // Typed call through IPyth, not `abi.encodeWithSignature`.
        //
        // The string version was a real hazard: if the signature ever drifted
        // from what the adapter implements, the selector would hit no function
        // and the call would simply miss — no revert, no event, no trace. The
        // only thing guarding it was one test asserting a counter moved. A typed
        // call turns that class of mistake into a compile error, and type-checks
        // the argument encoding rather than trusting a hand-written string.
        //
        // `updatePriceFeeds` is declared payable on IPyth because the real Pyth
        // contract charges a fee for it. `PythOracleAdapter` reimplements it as
        // non-payable and funds the fee from its own balance, which is fine to
        // call with zero value — payability is not part of the selector.
        try IPyth(updater).updatePriceFeeds(pythUpdateData) {
            emit PricePushSucceeded(updater, pythUpdateData.length);
        } catch {
            // Best-effort by design. A stale or unfundable update must not brick
            // a close or a liquidation, because `getPrice` performs its own
            // staleness check and that is the one that decides correctness.
            //
            // But it must not be invisible either. Before this, a push that
            // failed — wrong address, depleted MON balance, malformed update —
            // left the caller with no signal at all: the trade succeeded and
            // only the price silently aged.
            emit PricePushFailed(updater, pythUpdateData.length);
        }
    }

    function _requireOpen(uint256 positionId) internal view returns (Position memory p) {
        if (!isOpen[positionId]) revert PositionNotOpen(positionId);
        p = _positions[positionId];
    }

    function _close(uint256 positionId, Position memory p) internal {
        isOpen[positionId] = false;
        totalPayoutCapUsd -= p.payoutCapUsd;

        // Release this position's notional from the feed's skew, or the book
        // would keep charging for a position that no longer exists.
        if (p.isLong) {
            longOpenInterestUsd[p.feedId] -= p.sizeUsd;
        } else {
            shortOpenInterestUsd[p.feedId] -= p.sizeUsd;
        }

        delete _positions[positionId];
    }

    /// @dev The funding index as of the current block, without writing state.
    ///
    /// Used by views so `isLiquidatable` and `fundingOwed` report the same
    /// verdict a transaction would produce. Without this a view would lag by one
    /// block, and a bot reading it would submit liquidations that no longer
    /// apply (or miss ones that now do).
    function _projectedFundingIndex(bytes32 feedId) internal view returns (int256) {
        uint256 last = lastFundingBlock[feedId];
        if (last == 0 || last == block.number) return cumulativeFundingIndex[feedId];

        (int256 delta, ) = _fundingDelta(feedId, block.number - last);
        return cumulativeFundingIndex[feedId] + delta;
    }

    // ==================== FUNDING INTERNALS ====================

    /// @dev Signed skew in WAD: `(long - short) / (long + short) * WAD`.
    ///
    /// Positive when longs dominate. Zero when the book is balanced OR when
    /// there is no open interest at all — in both cases funding is zero, which
    /// is the correct behaviour: a balanced book has nothing to arbitrage and an
    /// empty one has nobody to charge.
    function _skewWad(bytes32 feedId) internal view returns (int256) {
        uint256 longs = longOpenInterestUsd[feedId];
        uint256 shorts = shortOpenInterestUsd[feedId];
        uint256 total = longs + shorts;
        if (total == 0) return 0;

        // Both branches keep the division last so the result is exact to one
        // WAD unit; dividing first would floor away the whole skew on small books.
        if (longs >= shorts) {
            return (int256(longs - shorts) * PerpConstants.WAD) / int256(total);
        }
        return -(int256(shorts - longs) * PerpConstants.WAD) / int256(total);
    }

    /// @dev Funding delta for `elapsed` blocks, and the skew that produced it.
    ///
    ///   delta = elapsed * FUNDING_RATE_PER_BLOCK_WAD * skewWad / WAD
    ///
    /// Two truncations happen, in this order. Truncation here means a small
    /// skew over few blocks can accrue exactly zero — that is acceptable (it
    /// rounds against the crowded side, i.e. conservatively) and unavoidable in
    /// integer maths. The alternative, carrying a remainder accumulator, buys
    /// precision nobody can measure for real money.
    function _fundingDelta(bytes32 feedId, uint256 elapsed)
        internal
        view
        returns (int256 delta, int256 skewWad)
    {
        skewWad = _skewWad(feedId);
        if (skewWad == 0) return (0, 0);

        int256 gross = int256(elapsed) * fundingRatePerBlockWad;
        delta = (gross * skewWad) / PerpConstants.WAD;
    }

    /// @dev Funding a position owes at `indexNow`, positive meaning it pays.
    ///
    /// Sign convention, and the reason for the side multiplier:
    ///
    ///   - the index rises when LONGS dominate, because the crowded side pays
    ///   - a long's obligation is therefore `+size * delta`
    ///   - a short's is `-size * delta`, since the short is the side being paid
    ///
    /// Without the side sign both sides are charged identically and the short
    /// never receives anything — funding becomes a fee rather than a transfer
    /// between the two sides, which is not what it is.
    ///
    /// Note this is deliberately NOT `-size` for a short followed by a sign flip
    /// on the index. Keeping the direction in the index and the side in the
    /// multiplier means a short-heavy book works out symmetrically: the index
    /// falls, so `-size * negative` is positive and the crowded short pays.
    function _fundingFor(Position memory p, int256 indexNow) internal pure returns (int256) {
        int256 delta = indexNow - p.entryFundingIndex;
        if (delta == 0) return 0;

        int256 signedSize = p.isLong ? p.sizeUsd.toInt256() : -p.sizeUsd.toInt256();
        return (signedSize * delta) / PerpConstants.WAD;
    }

    /// @dev Equity after collateral, PnL and accrued funding.
    ///
    ///   equity = collateral + pnl - funding, floored at zero
    ///
    /// Funding is applied BEFORE the floor, so a position can be pushed into
    /// liquidation by the cost of carry alone. That is the point of per-block
    /// funding: on a crowded side the cost accumulates fast enough to matter
    /// within a single demo, which an 8-hourly rate could never do.
    ///
    /// The floor comes last. Applying it to PnL first would let funding revive a
    /// bankrupt position, which is both wrong and exploitable.
    function _equityAfterFunding(Position memory p, uint256 markPrice, int256 indexNow)
        internal
        pure
        returns (int256)
    {
        int256 pnl = _pnl(p, markPrice);
        int256 funding = _fundingFor(p, indexNow);
        return _clampToZero(p.collateralUsd.toInt256() + pnl - funding);
    }

    /// @dev Floors an equity figure at zero: a position cannot owe more than it
    ///      posted. Applied AFTER funding, so funding can drive a position into
    ///      liquidation but can never make it negative and wrap on the way out.
    function _clampToZero(int256 equity) internal pure returns (int256) {
        return equity < 0 ? int256(0) : equity;
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
    ///
    ///      Equity here is PnL MINUS funding, floored at zero. Funding is part of
    ///      the verdict on purpose: on a crowded side the cost of carry alone can
    ///      push a position through its maintenance margin, and that is the
    ///      mechanism that makes per-block funding bite.
    function _isLiquidatable(Position memory p, uint256 price) internal view returns (bool) {
        int256 equity = _equityAfterFunding(p, price, _projectedFundingIndex(p.feedId));
        uint256 mm = (p.sizeUsd * PerpConstants.MAINTENANCE_MARGIN_BPS) /
            PerpConstants.BPS_DENOMINATOR;
        return equity.toUint256() <= mm;
    }
}
