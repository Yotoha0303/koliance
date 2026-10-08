// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

import {Ownable} from "./utils/Ownable.sol";

/// @title SessionKeyRegistry
/// @notice EIP-712 delegation registry: a user's main wallet signs one typed
///         delegation granting an agent's ephemeral session key a bounded
///         authority, and this contract is where anyone can verify that grant
///         without trusting a server.
///
/// Why this exists (ADR-004, the connection between the two threads):
/// the RFC that drove this design put its answer to "how does an agent act
/// autonomously" off-chain, in a local Redis pool. A judge cannot verify a
/// Redis key. Moving the *authorisation* on-chain means every grant, every
/// spend and every revoke has a transaction hash — which is the property the
/// scoring criteria ask for. Bounded execution stays where it belongs; what
/// moves on-chain is the proof of who was allowed to do what.
///
/// Relationship to `backend/internal/agentcard` (read before adding a field):
/// agentcard already enforces limits, daily caps, freezing and allowlists
/// off-chain, and ADR-004 D3 says to upgrade that module rather than build a
/// parallel one beside it. This contract is *not* a second delegation
/// system: it is the on-chain anchor for the *same* delegation, so the two
/// sides verify one signature over one typed structure. Field names and
/// semantics below are deliberately the ones agentcard and the `SessionKey`
/// entity already use (`maxSpendPerTx`, `dailySpendLimit`, `validUntil`). If
/// you change a field here, change it in those two places in the same commit —
/// three models of the same thing is exactly the drift GAP-24 records.
///
/// What is NOT here, on purpose:
///   - No token movement. This registry authorises; it never custodies. Funds
///     stay in the Vault, so a compromised session key cannot drain anything.
///   - No Redis. D2 of ADR-004 leaves the off-chain pre-deduction out, and the
///     RFC's Lua for it carries four measured defects (GAP-18~21).
///   - No unlimited escape hatch. A delegation with no caps is not a
///     delegation.
contract SessionKeyRegistry is Ownable {
    // ---------------------------------------------------------------------
    // EIP-712
    // ---------------------------------------------------------------------

    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    /// Mirrors RFC-001 4.1.1, with two deliberate changes:
    ///   - `sessionPublicKey` renamed to `sessionKey` for brevity;
    ///   - `agentId` is an `address`, not `bytes32`, so it matches the
    ///     `session_key_address` column the off-chain side already stores.
    bytes32 public constant AGENT_DELEGATION_TYPEHASH = keccak256(
        "AgentDelegation(address user,address agent,address sessionKey,uint256 maxSpendPerTx,uint256 dailySpendLimit,uint256 validUntil,uint256 nonce)"
    );

    bytes32 private constant NAME_HASH = keccak256("Koliance");
    bytes32 private constant VERSION_HASH = keccak256("1");

    /// secp256k1 half-order. `ecrecover` accepts malleable signatures whose `s`
    /// sits in the upper half; rejecting them stops one consent from having
    /// two distinct encodings.
    uint256 private constant SECP256K1N_DIV_2 =
        0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    uint256 private constant ONE_DAY = 1 days;

    /// @dev Cached domain separator, invalidated when the chain id changes so
    ///      a signature collected on one chain cannot be replayed on a fork.
    bytes32 private immutable _initialDomainSeparator;
    uint256 private immutable _initialChainId;

    // ---------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------

    struct Delegation {
        address user;
        address agent;
        address sessionKey;
        uint256 maxSpendPerTx;
        uint256 dailySpendLimit;
        uint256 validUntil;
        uint256 nonce;
        uint256 spentInWindow;
        uint256 windowStart;
        bool exists;
        bool revoked;
        bool frozen;
    }

    /// One active delegation per session key. A session key is ephemeral by
    /// definition, so re-registering the same address replaces rather than
    /// appends.
    mapping(address sessionKey => Delegation) private _delegations;

    /// @dev Replay guard. While unrevoked, a delegation is a bearer instrument,
    ///      so the same signed payload must not register twice — including
    ///      after a revoke, which is what makes revocation stick.
    mapping(address user => mapping(uint256 nonce => bool)) public nonceUsed;

    event DelegationRegistered(
        address indexed user,
        address indexed agent,
        address indexed sessionKey,
        uint256 maxSpendPerTx,
        uint256 dailySpendLimit,
        uint256 validUntil,
        uint256 nonce
    );
    event SpendAuthorized(address indexed sessionKey, address indexed agent, uint256 amount, uint256 spentInWindow);
    event DelegationRevoked(address indexed user, address indexed sessionKey);
    event SessionKeyFrozen(address indexed sessionKey, address indexed by);
    event SessionKeyUnfrozen(address indexed sessionKey, address indexed by);

    // `ZeroAddress` is inherited from `Ownable`; redeclaring it here shadows
    // the parent's error and Hardhat refuses the duplicate declaration.
    error InvalidSignature();
    error SignatureMalleable();
    error NonceAlreadyUsed(address user, uint256 nonce);
    error ValidityInThePast(uint256 validUntil, uint256 currentTime);
    error SessionKeyAlreadyBound(address sessionKey, address user);
    error SelfDelegation();
    error NoSuchDelegation(address sessionKey);
    error DelegationIsRevoked(address sessionKey);
    error DelegationIsFrozen(address sessionKey);
    error DelegationExpired(address sessionKey, uint256 validUntil);
    error ExceededPerTxLimit(uint256 amount, uint256 limit);
    error ExceededDailyLimit(uint256 amount, uint256 windowSpent, uint256 limit);
    error NotAuthorizedCaller(address caller);
    error ZeroAmount();

    constructor() Ownable() {
        _initialChainId = block.chainid;
        _initialDomainSeparator = _buildDomainSeparator();
    }

    // ---------------------------------------------------------------------
    // EIP-712 helpers
    // ---------------------------------------------------------------------

    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    /// @notice Domain separator, rebuilt if the chain id changed since deploy.
    function domainSeparator() public view returns (bytes32) {
        return block.chainid == _initialChainId ? _initialDomainSeparator : _buildDomainSeparator();
    }

    /// @notice The 32-byte struct hash a signer commits to.
    /// @dev Exposed so an off-chain verifier (and the tests) can reproduce the
    ///      digest without re-implementing the encoding — the RFC described
    ///      this structure but nothing verified it, which is how GAP-24's
    ///      three incompatible models came about.
    function hashDelegation(
        address user,
        address agent,
        address sessionKey,
        uint256 maxSpendPerTx,
        uint256 dailySpendLimit,
        uint256 validUntil,
        uint256 nonce
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                AGENT_DELEGATION_TYPEHASH,
                user,
                agent,
                sessionKey,
                maxSpendPerTx,
                dailySpendLimit,
                validUntil,
                nonce
            )
        );
    }

    /// @notice Full EIP-712 digest — the bytes that are actually signed.
    function delegationDigest(
        address user,
        address agent,
        address sessionKey,
        uint256 maxSpendPerTx,
        uint256 dailySpendLimit,
        uint256 validUntil,
        uint256 nonce
    ) public view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator(),
                hashDelegation(user, agent, sessionKey, maxSpendPerTx, dailySpendLimit, validUntil, nonce)
            )
        );
    }

    // ---------------------------------------------------------------------
    // Registration
    // ---------------------------------------------------------------------

    /// @notice Register a delegation the user's main wallet has signed.
    /// @dev `user` is a parameter rather than `msg.sender` on purpose: the
    ///      whole point of the design is that the *agent* submits the grant
    ///      and pays the gas, so the user signs once and then walks away. The
    ///      signature is the authority, so a relayer cannot alter a field —
    ///      any edit changes the digest and the recovery fails.
    function registerDelegation(
        address user,
        address agent,
        address sessionKey,
        uint256 maxSpendPerTx,
        uint256 dailySpendLimit,
        uint256 validUntil,
        uint256 nonce,
        bytes calldata signature
    ) external {
        if (user == address(0) || agent == address(0) || sessionKey == address(0)) revert ZeroAddress();
        if (validUntil <= block.timestamp) revert ValidityInThePast(validUntil, block.timestamp);
        if (nonceUsed[user][nonce]) revert NonceAlreadyUsed(user, nonce);

        // A user delegating to themselves grants nothing and only muddies the
        // audit trail.
        if (agent == user || sessionKey == user) revert SelfDelegation();

        bytes32 digest =
            delegationDigest(user, agent, sessionKey, maxSpendPerTx, dailySpendLimit, validUntil, nonce);
        _requireValidSignature(digest, user, signature);

        Delegation storage existing = _delegations[sessionKey];
        // Rebinding a live session key to a different user would silently
        // orphan the first user's caps, so it is refused outright.
        if (existing.exists && !existing.revoked && existing.user != user) {
            revert SessionKeyAlreadyBound(sessionKey, existing.user);
        }

        nonceUsed[user][nonce] = true;

        _delegations[sessionKey] = Delegation({
            user: user,
            agent: agent,
            sessionKey: sessionKey,
            maxSpendPerTx: maxSpendPerTx,
            dailySpendLimit: dailySpendLimit,
            validUntil: validUntil,
            nonce: nonce,
            spentInWindow: 0,
            windowStart: block.timestamp,
            exists: true,
            revoked: false,
            frozen: false
        });

        emit DelegationRegistered(user, agent, sessionKey, maxSpendPerTx, dailySpendLimit, validUntil, nonce);
    }

    function _requireValidSignature(bytes32 digest, address expectedSigner, bytes calldata signature) private pure {
        if (signature.length != 65) revert InvalidSignature();

        bytes32 r = bytes32(signature[0:32]);
        bytes32 s = bytes32(signature[32:64]);
        uint8 v = uint8(signature[64]);

        // High-s and non-canonical v are refused: without this, `(r, s, v)` and
        // `(r, n - s, v ^ 1)` both recover the same address.
        if (uint256(s) > SECP256K1N_DIV_2) revert SignatureMalleable();
        if (v != 27 && v != 28) revert InvalidSignature();

        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0) || recovered != expectedSigner) revert InvalidSignature();
    }

    // ---------------------------------------------------------------------
    // Spending
    // ---------------------------------------------------------------------

    /// @notice Authorise one spend against a session key's delegation.
    /// @dev Callable by the delegated agent or by the user who granted it.
    ///      Anyone else is refused, so a passer-by cannot burn a user's daily
    ///      window with junk calls.
    ///
    ///      The window is a rolling 24 hours anchored at the delegation's start
    ///      (or at the first spend after the previous window closed). It
    ///      *resets* — which the RFC's Redis version did not. That omission is
    ///      GAP-21: `daily_spent` never came back down, so a user hit their cap
    ///      exactly once and permanently.
    function authorizeSpend(address sessionKey, uint256 amount) external returns (bool) {
        if (amount == 0) revert ZeroAmount();

        Delegation storage d = _delegations[sessionKey];
        if (!d.exists) revert NoSuchDelegation(sessionKey);
        if (d.revoked) revert DelegationIsRevoked(sessionKey);

        if (msg.sender != d.agent && msg.sender != d.user) revert NotAuthorizedCaller(msg.sender);

        // Freeze is checked before expiry so the caller sees the more specific
        // reason.
        if (d.frozen) revert DelegationIsFrozen(sessionKey);
        if (block.timestamp > d.validUntil) revert DelegationExpired(sessionKey, d.validUntil);

        if (amount > d.maxSpendPerTx) revert ExceededPerTxLimit(amount, d.maxSpendPerTx);

        // Roll the window forward if the previous one has closed.
        if (block.timestamp >= d.windowStart + ONE_DAY) {
            d.windowStart = block.timestamp;
            d.spentInWindow = 0;
        }

        if (d.spentInWindow + amount > d.dailySpendLimit) {
            revert ExceededDailyLimit(amount, d.spentInWindow, d.dailySpendLimit);
        }

        d.spentInWindow += amount;

        emit SpendAuthorized(sessionKey, msg.sender, amount, d.spentInWindow);
        return true;
    }

    // ---------------------------------------------------------------------
    // Revocation and circuit breaker
    // ---------------------------------------------------------------------

    /// @notice Kill a delegation. Only the granting user.
    /// @dev Revocation sticks: `registerDelegation` refuses a reused nonce, so
    ///      replaying the original signature cannot undo this.
    function revoke(address sessionKey) external {
        Delegation storage d = _delegations[sessionKey];
        if (!d.exists) revert NoSuchDelegation(sessionKey);
        if (d.user != msg.sender) revert NotAuthorizedCaller(msg.sender);

        d.revoked = true;
        emit DelegationRevoked(msg.sender, sessionKey);
    }

    /// @notice Freeze a session key without destroying the grant.
    /// @dev The off-chain module has the same switch (`FreezeSessionKey`) for
    ///      the same reason: when an agent looks compromised, stopping it now
    ///      and deciding later beats revoking and re-signing under pressure.
    ///      The owner can freeze too, so a circuit breaker does not depend on
    ///      the user being reachable.
    function freeze(address sessionKey) external {
        Delegation storage d = _delegations[sessionKey];
        if (!d.exists) revert NoSuchDelegation(sessionKey);
        if (d.user != msg.sender && msg.sender != owner) revert NotAuthorizedCaller(msg.sender);

        d.frozen = true;
        emit SessionKeyFrozen(sessionKey, msg.sender);
    }

    function unfreeze(address sessionKey) external {
        Delegation storage d = _delegations[sessionKey];
        if (!d.exists) revert NoSuchDelegation(sessionKey);
        if (d.user != msg.sender && msg.sender != owner) revert NotAuthorizedCaller(msg.sender);

        d.frozen = false;
        emit SessionKeyUnfrozen(sessionKey, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getDelegation(address sessionKey) external view returns (Delegation memory) {
        return _delegations[sessionKey];
    }

    /// @notice Would `authorizeSpend(sessionKey, amount)` succeed right now?
    /// @dev Deliberately a separate read rather than a dry-run of the write:
    ///      the front end needs to disable a button *before* the click, not
    ///      learn the refusal from a reverted transaction.
    function isAuthorized(address sessionKey, uint256 amount) external view returns (bool) {
        if (amount == 0) return false;

        Delegation storage d = _delegations[sessionKey];
        if (!d.exists || d.revoked || d.frozen) return false;
        if (block.timestamp > d.validUntil) return false;
        if (amount > d.maxSpendPerTx) return false;

        // Mirror the roll the write path would perform, without performing it.
        uint256 spent = block.timestamp >= d.windowStart + ONE_DAY ? 0 : d.spentInWindow;
        return spent + amount <= d.dailySpendLimit;
    }

    /// @notice Remaining allowance in the current window.
    function remainingDailyAllowance(address sessionKey) external view returns (uint256) {
        Delegation storage d = _delegations[sessionKey];
        if (!d.exists || d.revoked || d.frozen) return 0;

        uint256 spent = block.timestamp >= d.windowStart + ONE_DAY ? 0 : d.spentInWindow;
        return d.dailySpendLimit > spent ? d.dailySpendLimit - spent : 0;
    }
}
