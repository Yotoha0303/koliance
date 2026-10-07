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
    event PositionManagerSet(address indexed positionManager);

    /// @notice Deposit `amount` USDC (6 decimals), receive LP shares (18 decimals).
    function addLiquidity(uint256 amount) external returns (uint256 shares);

    /// @notice Burn `shares`, receive the proportional USDC back.
    function removeLiquidity(uint256 shares) external returns (uint256 amount);

    /// @notice Total USDC under management, normalized to 18-decimal USD.
    function totalAssets() external view returns (uint256);

    /// @notice LP shares held by `provider`.
    function sharesOf(address provider) external view returns (uint256);

    /// @notice Pay out trader profit, denominated in 18-decimal USD.
    /// @dev Reverts rather than settling a payout the pool cannot fund.
    function payOut(address to, uint256 amount) external;

    /// @notice Book trading fees into the pool, denominated in 18-decimal USD.
    /// @dev Fees are already in the Vault — trading collateral is held here, so a
    ///      winning-less-than-collateral close simply leaves the difference behind.
    ///      This call only records the amount for reporting; it moves no funds.
    function receiveFees(uint256 amount) external;

    // ==================== WIRING ====================
    //
    // Vault and PositionManager reference each other, so neither can take the
    // other as a constructor argument. Deploy both, then wire once.

    /// @notice One-time wiring of the PositionManager. Reverts if already set.
    function setPositionManager(address positionManager) external;

    function positionManager() external view returns (address);
}
