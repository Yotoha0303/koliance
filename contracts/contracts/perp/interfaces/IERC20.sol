// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

/// @title IERC20
/// @notice Minimal ERC-20 surface used by the perp module.
///
/// Deliberately not OpenZeppelin's full interface — the Vault only needs balance,
/// transfer, transferFrom, and decimals. Both MockUSDC and real USDC return a bool
/// from transfer/transferFrom, so the return value is checked rather than ignored.
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}
