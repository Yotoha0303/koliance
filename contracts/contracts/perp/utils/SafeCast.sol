// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

/// @title SafeCast
/// @notice Narrow casting helpers.
///
/// Solidity 0.8 checks arithmetic but not every narrowing conversion; `int256(x)`
/// on a uint256 beyond type(int256).max wraps silently. These helpers revert instead.
library SafeCast {
    error CastOverflow();

    function toInt256(uint256 value) internal pure returns (int256) {
        if (value > uint256(type(int256).max)) revert CastOverflow();
        return int256(value);
    }

    function toUint256(int256 value) internal pure returns (uint256) {
        if (value < 0) revert CastOverflow();
        return uint256(value);
    }
}
