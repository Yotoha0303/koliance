// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

import {IPyth, PythStructs} from "../interfaces/IPyth.sol";

/// @title MockPyth
/// @notice Test double for the Pyth contract.
///
/// Exists so the adapter's normalization can be tested against the exponent values
/// real feeds actually report. That matters: BTC/USD returns expo -8 while
/// Equity.US.NVDA/USD returns -5, so a hardcoded exponent misprices equity feeds by
/// three orders of magnitude. Exercising both is the point of this mock.
///
/// Test-only. Not deployed anywhere.
contract MockPyth is IPyth {
    struct Feed {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }

    mapping(bytes32 => Feed) internal _feeds;
    mapping(bytes32 => bool) internal _exists;

    uint256 public validTimePeriod = 60;
    uint256 public updateFee = 1;
    uint256 public updateCallCount;

    function setPrice(
        bytes32 feedId,
        int64 price,
        int32 expo,
        uint256 publishTime,
        uint64 conf
    ) external {
        _feeds[feedId] = Feed(price, conf, expo, publishTime);
        _exists[feedId] = true;
    }

    function setExists(bytes32 feedId, bool exists) external {
        _exists[feedId] = exists;
    }

    function setValidTimePeriod(uint256 period) external {
        validTimePeriod = period;
    }

    function setUpdateFee(uint256 fee) external {
        updateFee = fee;
    }

    function getValidTimePeriod() external view returns (uint256) {
        return validTimePeriod;
    }

    function priceFeedExists(bytes32 id) external view returns (bool) {
        return _exists[id];
    }

    function getPriceUnsafe(bytes32 id) external view returns (PythStructs.Price memory) {
        Feed memory f = _feeds[id];
        return PythStructs.Price(f.price, f.conf, f.expo, f.publishTime);
    }

    function getPriceNoOlderThan(bytes32 id, uint256 age)
        external
        view
        returns (PythStructs.Price memory)
    {
        Feed memory f = _feeds[id];
        require(block.timestamp <= f.publishTime + age, "StalePrice");
        return PythStructs.Price(f.price, f.conf, f.expo, f.publishTime);
    }

    function getUpdateFee(bytes[] calldata) external view returns (uint256) {
        return updateFee;
    }

    function updatePriceFeeds(bytes[] calldata) external payable {
        require(msg.value >= updateFee, "InsufficientFee");
        updateCallCount++;
    }
}
