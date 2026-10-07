// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

/// @title Ownable
/// @notice Minimal single-owner access control.
///
/// Hand-rolled rather than pulled from OpenZeppelin: the repo carries no OZ
/// dependency and the perp module only needs a transfer plus a guard. Swap this
/// for OZ if the project adopts OZ elsewhere — the surface is deliberately the
/// same so the change is mechanical.
abstract contract Ownable {
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner(address caller);
    error ZeroAddress();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
