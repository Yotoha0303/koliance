// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

/// @title MockPositionManager
/// @notice Test double for the Vault's reserve query.
///
/// The real PositionManager does not exist yet. The Vault only ever calls
/// `reservedAssets()` on its counterparty, and it calls it through a cast rather
/// than an `is IPositionManager` binding, so this needs nothing else — implementing
/// the full interface here would mean stubbing a dozen functions that the Vault
/// never touches.
///
/// Test-only. Not deployed anywhere.
contract MockPositionManager {
    uint256 public reserved;

    function setReserved(uint256 amount) external {
        reserved = amount;
    }

    function reservedAssets() external view returns (uint256) {
        return reserved;
    }
}
