// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

/// @title IPriceOracle
/// @notice Price source abstraction for the perp module.
///
/// Business contracts（Vault / PositionManager）ONLY depend on this interface,
/// never on Pyth directly. Two implementations exist:
///   - PythOracleAdapter : production path, reads live Pyth feeds on Monad
///   - DemoOracle        : deterministic demo trigger, owner-settable prices
///
/// Swapping implementations must never require touching business logic.
interface IPriceOracle {
    /// @param feedId Pyth price feed id
    /// @return price       USD price normalized to 18 decimals
    /// @return publishTime unix timestamp the price was published at
    function getPrice(bytes32 feedId) external view returns (uint256 price, uint256 publishTime);
}
