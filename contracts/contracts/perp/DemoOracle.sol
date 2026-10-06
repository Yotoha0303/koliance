// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {Ownable} from "./utils/Ownable.sol";
import {SafeCast} from "./utils/SafeCast.sol";
import {PerpConstants} from "./PerpConstants.sol";

/// @title DemoOracle
/// @notice Deterministic, owner-settable price source implementing {IPriceOracle}.
///
/// Why this exists
/// ---------------
/// Two independent reasons, and only the second survived contact with reality:
///
///   1. (original) Fallback for US equity feeds that freeze outside market hours.
///      This turned out to be unnecessary — Pyth publishes 24/7 `Equity.Index.*`
///      feeds, verified 2026-10-05.
///   2. (actual) Deterministic demo trigger. Real NVDA does not drop 15% because
///      someone pressed a button on stage. The liquidation demo needs a price move
///      that is instant, reproducible, and under the presenter's control.
///
/// Because it sits behind {IPriceOracle}, swapping it for `PythOracleAdapter` never
/// touches Vault or PositionManager.
///
/// Testnet/demo only. Prices here are whatever the owner says they are.
contract DemoOracle is IPriceOracle, Ownable {
    using SafeCast for uint256;
    using SafeCast for int256;
    /// @notice Price per feed, 18-decimal USD. Zero means "not set".
    mapping(bytes32 => uint256) public priceOf;

    /// @notice Publish timestamp per feed, surfaced through {getPrice}.
    mapping(bytes32 => uint256) public publishTimeOf;

    error PriceNotSet(bytes32 feedId);
    error InvalidPrice();
    error InvalidBps();

    event PriceSet(bytes32 indexed feedId, uint256 price, uint256 timestamp);

    /// @notice Set an absolute price. `price` is 18-decimal USD.
    function setPrice(bytes32 feedId, uint256 price) external onlyOwner {
        if (price == 0) revert InvalidPrice();
        priceOf[feedId] = price;
        publishTimeOf[feedId] = block.timestamp;
        emit PriceSet(feedId, price, block.timestamp);
    }

    /// @notice Set several prices in one transaction — used to seed the demo.
    function setPrices(bytes32[] calldata feedIds, uint256[] calldata prices) external onlyOwner {
        if (feedIds.length != prices.length) revert InvalidPrice();
        for (uint256 i = 0; i < feedIds.length; i++) {
            if (prices[i] == 0) revert InvalidPrice();
            priceOf[feedIds[i]] = prices[i];
            publishTimeOf[feedIds[i]] = block.timestamp;
            emit PriceSet(feedIds[i], prices[i], block.timestamp);
        }
    }

    /// @notice Move a price by a signed basis-point delta.
    ///
    /// This is the one-button demo control: `bumpPrice(feedId, -1500)` is a 15%
    /// drop, which is what the "crash the market" button calls. Kept on chain so
    /// the presenter does not need to compute the resulting price off-chain and
    /// so the move is auditable in the explorer alongside the liquidations.
    ///
    /// @param deltaBps positive to rise, negative to fall. 100 bps = 1%.
    function bumpPrice(bytes32 feedId, int256 deltaBps) external onlyOwner {
        uint256 current = priceOf[feedId];
        if (current == 0) revert PriceNotSet(feedId);

        int256 bps = PerpConstants.BPS_DENOMINATOR.toInt256();
        if (deltaBps <= -bps || deltaBps >= bps) revert InvalidBps();

        // deltaBps is strictly inside (-10000, 10000), so the multiplier is
        // positive and cannot underflow.
        int256 next = current.toInt256() + (current.toInt256() * deltaBps) / bps;
        if (next <= 0) revert InvalidPrice();

        uint256 result = uint256(next);
        priceOf[feedId] = result;
        publishTimeOf[feedId] = block.timestamp;
        emit PriceSet(feedId, result, block.timestamp);
    }

    /// @inheritdoc IPriceOracle
    function getPrice(bytes32 feedId) external view returns (uint256 price, uint256 publishTime) {
        price = priceOf[feedId];
        if (price == 0) revert PriceNotSet(feedId);
        publishTime = publishTimeOf[feedId];
    }
}
