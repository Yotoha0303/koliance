// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {IPyth, PythStructs} from "./interfaces/IPyth.sol";
import {Ownable} from "./utils/Ownable.sol";
import {SafeCast} from "./utils/SafeCast.sol";
import {PerpConstants} from "./PerpConstants.sol";

/// @title PythOracleAdapter
/// @notice Production {IPriceOracle} backed by a Pyth pull oracle.
///
/// Business contracts never touch Pyth — they call `getPrice(feedId)` through the
/// interface, so swapping this for `DemoOracle` changes nothing above it.
///
/// Feed availability
/// -----------------
/// Verify a feed with `priceFeedExists` before relying on it. Pyth's off-chain
/// metadata lists feeds that are not deployed to every chain: on Monad Testnet the
/// 24/7 `Equity.Index.*` feeds appear in Hermes but are absent on chain, while the
/// crypto feeds and the session-only `Equity.US.*` variants are present. See the
/// project notes for the exact probe results.
///
/// Staleness
/// ---------
/// This is a pull oracle: prices only change when someone submits an update. On a
/// testnet nobody does, so a feed can be present and still months old —
/// `Equity.US.NVDA/USD` was 143 days stale when checked. `getPriceNoOlderThan`
/// turns that into a revert rather than a silently wrong price, which is the
/// correct failure mode for a margin system.
///
/// Fees
/// ----
/// `updatePriceFeeds` is payable. Rather than making every PositionManager entry
/// point payable, this adapter pays Pyth's fee from its own MON balance, funded by
/// the owner. That keeps the PositionManager's non-payable call path working.
contract PythOracleAdapter is IPriceOracle, Ownable {
    using SafeCast for int256;
    using SafeCast for uint256;

    /// @notice The Pyth contract on this chain.
    IPyth public immutable pyth;

    /// @notice Maximum age of a price before {getPrice} reverts, in seconds.
    uint256 public maxStaleness;

    error StalePeriodTooShort(uint256 provided);
    error FeedNotRegistered(bytes32 feedId);
    error NonPositivePrice(bytes32 feedId, int64 price);
    error ExponentOutOfRange(int32 expo);
    error InsufficientFeeBalance(uint256 required, uint256 held);

    event MaxStalenessSet(uint256 maxStaleness);
    event PricePushed(uint256 updateCount, uint256 feePaid);

    constructor(address pyth_, uint256 maxStaleness_, address owner_) Ownable() {
        if (pyth_ == address(0)) revert ZeroAddress();

        pyth = IPyth(pyth_);

        // The contract itself refuses updates closer together than this, so a
        // shorter window here would only produce confusing reverts.
        //
        // The probe is guarded because a constructor that cannot complete when an
        // external contract is absent is a deployment hazard, and it makes the
        // Ignition module un-simulatable locally, where no Pyth deployment exists.
        //
        // The `code.length` check is load-bearing, not defensive theatre: calling an
        // address with no code returns *empty* data, which fails ABI decoding rather
        // than reverting — and a decoding failure is not caught by `catch`, so a
        // try/catch alone would still revert the constructor. Both guards are needed.
        uint256 validPeriod = 0;
        if (pyth_.code.length > 0) {
            try IPyth(pyth_).getValidTimePeriod() returns (uint256 vp) {
                validPeriod = vp;
            } catch {
                // Pyth present but not answering as expected; store as given.
            }
        }
        if (validPeriod != 0 && maxStaleness_ < validPeriod) {
            revert StalePeriodTooShort(maxStaleness_);
        }
        maxStaleness = maxStaleness_;

        if (owner_ != msg.sender) {
            if (owner_ == address(0)) revert ZeroAddress();
            emit OwnershipTransferred(msg.sender, owner_);
            owner = owner_;
        }
    }

    /// @notice Accept MON to cover Pyth update fees.
    receive() external payable {}

    function setMaxStaleness(uint256 maxStaleness_) external onlyOwner {
        if (maxStaleness_ < pyth.getValidTimePeriod()) revert StalePeriodTooShort(maxStaleness_);
        maxStaleness = maxStaleness_;
        emit MaxStalenessSet(maxStaleness_);
    }

    /// @notice Withdraw leftover MON.
    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    // ==================== PUSH ====================

    /// @notice Submit signed Pyth updates so the next {getPrice} is fresh.
    ///
    /// Signature matches what PositionManager expects on its `priceUpdater`:
    /// `updatePriceFeeds(bytes[])`. Not payable — the fee comes from this contract's
    /// balance, which is why that call path does not need to carry value.
    ///
    /// Reverts if this contract cannot cover the fee. A caller that wants a
    /// best-effort push (PositionManager does) will swallow that revert, which is
    /// intended: a funding shortfall should not brick a liquidation.
    function updatePriceFeeds(bytes[] calldata updateData) external {
        if (updateData.length == 0) return;

        uint256 fee = pyth.getUpdateFee(updateData);
        if (address(this).balance < fee) {
            revert InsufficientFeeBalance(fee, address(this).balance);
        }

        pyth.updatePriceFeeds{value: fee}(updateData);

        emit PricePushed(updateData.length, fee);
    }

    // ==================== READ ====================

    /// @inheritdoc IPriceOracle
    function getPrice(bytes32 feedId) external view returns (uint256 price, uint256 publishTime) {
        return _read(feedId, maxStaleness);
    }

    /// @notice Read with an explicit staleness bound, overriding the default.
    function getPriceNoOlderThan(bytes32 feedId, uint256 age)
        external
        view
        returns (uint256 price, uint256 publishTime)
    {
        return _read(feedId, age);
    }

    /// @notice Whether Pyth has this feed registered on this chain.
    function feedExists(bytes32 feedId) external view returns (bool) {
        return pyth.priceFeedExists(feedId);
    }

    // ==================== INTERNAL ====================

    function _read(bytes32 feedId, uint256 age) internal view returns (uint256, uint256) {
        // getPriceNoOlderThan already reverts on an unknown feed, but the selector it
        // uses is indistinguishable from a staleness failure without decoding it, so
        // check explicitly for a legible error.
        if (!pyth.priceFeedExists(feedId)) revert FeedNotRegistered(feedId);

        PythStructs.Price memory p = pyth.getPriceNoOlderThan(feedId, age);
        return (_normalize(feedId, p), p.publishTime);
    }

    /// @dev Pyth reports `int64 price` with a separate `int32 expo`, e.g.
    ///      BTC at 8310629537408 with expo -8 means $83106.29537408.
    ///
    ///      The exponent is read from the response, never assumed. It varies by
    ///      feed — BTC/USD uses -8, while `Equity.US.NVDA/USD` uses -5 — so a
    ///      hardcoded -8 would misprice equity feeds by three orders of magnitude.
    ///
    ///      Scaling multiplies when the target precision exceeds the source and
    ///      divides otherwise. Dividing only in that second case (rather than always
    ///      multiplying then dividing) avoids truncating away significant digits.
    function _normalize(bytes32 feedId, PythStructs.Price memory p) internal pure returns (uint256) {
        if (p.price <= 0) revert NonPositivePrice(feedId, p.price);

        int256 target = PerpConstants.USD_DECIMALS.toInt256();
        int256 shift = target + int256(p.expo);

        // int64 -> int256 is a widening conversion and always safe; the SafeCast
        // step that can revert is the int256 -> uint256 one below.
        uint256 magnitude = int256(p.price).toUint256();

        // Guard against a nonsensical exponent before it drives a 10**x.
        if (shift > 36 || shift < -36) revert ExponentOutOfRange(p.expo);

        if (shift >= 0) {
            return magnitude * (10 ** uint256(shift));
        }
        return magnitude / (10 ** uint256(-shift));
    }
}
