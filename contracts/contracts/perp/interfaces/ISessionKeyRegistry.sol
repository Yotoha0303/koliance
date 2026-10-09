// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

/// @title ISessionKeyRegistry
/// @notice The slice of `SessionKeyRegistry` that `PositionManager` needs.
///
/// Deliberately narrow. `PositionManager` has no business reading caps and
/// windows itself — that logic lives in one place, and duplicating it here is
/// how two implementations of the same rule start disagreeing. This manager
/// asks two questions: may this session key spend this much, and record that it
/// did. Everything else stays behind the registry's own interface.
///
/// Units. The registry treats amounts as opaque `uint256` — it caps *a* spend,
/// and it has no opinion about what is being spent. The unit is therefore the
/// consuming module's, and each consumer must say which: the perp path passes
/// `collateralAmount` in **USDC base units** (6 decimals, the same number the
/// ERC-20 transfer uses), never the 18-decimal USD figure `PositionManager`
/// stores internally. Mixing the two would make a cap look 10^12 times looser
/// than intended, so `openPositionFor` passes the raw transfer amount and
/// nothing else.
///
/// The split matters more than it looks. GAP-24 records three incompatible
/// Session Key models in this repository precisely because the rule was
/// re-implemented per site instead of read from one. A delegation cap that the
/// registry enforces but the manager re-checks differently would be a fourth.
interface ISessionKeyRegistry {
    /// @notice Would `authorizeSpend(sessionKey, amount)` succeed right now?
    function isAuthorized(address sessionKey, uint256 amount) external view returns (bool);

    /// @notice Consume `amount` of the session key's current allowance, as the
    ///         designated consuming module.
    /// @dev This is the *module* entry, not `authorizeSpend`. The distinction
    ///      exists because the manager is a contract: it cannot present itself
    ///      as the agent, and the agent is an EOA that cannot charge on the
    ///      manager's behalf without asserting its own success. So the registry
    ///      owner names one module, and `chargeSpend` is what that module gets.
    ///      The caps applied are the same ones `authorizeSpend` applies.
    ///
    ///      Reverts when the spend is not permitted. Callers should treat the
    ///      revert as the authority — checking `isAuthorized` first is for
    ///      refusing early with a better message, not a substitute.
    function chargeSpend(address sessionKey, uint256 amount) external returns (bool);

    /// @notice The user who granted this session key its authority.
    /// @dev Returns `address(0)` when no delegation exists.
    function delegationOwner(address sessionKey) external view returns (address);

    /// @notice The agent the user named in the delegation.
    /// @dev Returns `address(0)` when no delegation exists. Distinct from the
    ///      owner because "who may spend this" and "who holds the key" are two
    ///      different questions, and collapsing them would let any holder of
    ///      the key act as the delegating party.
    function delegationAgent(address sessionKey) external view returns (address);
}
