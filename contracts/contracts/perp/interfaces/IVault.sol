// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

/// @title IVault
/// @notice Liquidity vault acting as the counterparty to all positions (GMX v1 style).
///
/// LPs deposit USDC and take the other side of every trade. Fees accrue into the
/// pool. Solvency guardrails live in the implementation: the vault must revert
/// rather than settle a payout it cannot fund — never mint value from nothing.
interface IVault {
    event LiquidityAdded(address indexed provider, uint256 amount, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 shares, uint256 amount);
    event FeesReceived(uint256 amount);
    event PaidOut(address indexed to, uint256 amount);

    /// @notice Deposit `amount` USDC, receive LP shares.
    function addLiquidity(uint256 amount) external returns (uint256 shares);

    /// @notice Burn `shares`, receive the proportional USDC back.
    function removeLiquidity(uint256 shares) external returns (uint256 amount);

    /// @notice Total USDC under management.
    function totalAssets() external view returns (uint256);

    /// @notice LP shares held by `provider`.
    function sharesOf(address provider) external view returns (uint256);

    /// @notice Pay out trader profit. Restricted to the PositionManager.
    function payOut(address to, uint256 amount) external;

    /// @notice Book trading fees into the pool. Restricted to the PositionManager.
    function receiveFees(uint256 amount) external;
}
