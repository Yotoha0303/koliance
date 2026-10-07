// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

/// @notice Mirrors the struct returned by the Pyth contract.
/// @dev Declared locally rather than imported from `@pythnetwork/pyth-sdk-solidity`
///      so the repo does not take on a package dependency for one struct. Field
///      order and types must match the deployed contract — they are ABI, not a
///      local convention.
library PythStructs {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }
}

/// @title IPyth
/// @notice The subset of the Pyth contract this project uses.
///
/// On Monad Testnet the deployment is `0x2880aB155794e7179c9eE2e38200202908C17B43`
/// (verified live 2026-10-06: `getValidTimePeriod()` returns 60).
interface IPyth {
    /// @notice Latest price without a staleness check. Cheap, and dangerous to use
    ///         directly — prefer {getPriceNoOlderThan}.
    function getPriceUnsafe(bytes32 id) external view returns (PythStructs.Price memory);

    /// @notice Latest price, reverting if older than `age` seconds.
    function getPriceNoOlderThan(bytes32 id, uint256 age)
        external
        view
        returns (PythStructs.Price memory);

    /// @notice Submit signed price updates. Payable: Pyth charges a fee.
    function updatePriceFeeds(bytes[] calldata updateData) external payable;

    /// @notice Fee required to submit `updateData`.
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256);

    /// @notice Whether a feed is registered on this chain.
    ///
    /// Worth checking before assuming a feed is usable. Pyth's off-chain metadata
    /// lists feeds that are not necessarily deployed to every chain: the 24/7
    /// `Equity.Index.*` feeds appear in Hermes but return false here, while
    /// `Equity.US.*` and the crypto feeds return true.
    function priceFeedExists(bytes32 id) external view returns (bool);

    /// @notice Feeds may not be updated more than once per this many seconds.
    function getValidTimePeriod() external view returns (uint256);
}
