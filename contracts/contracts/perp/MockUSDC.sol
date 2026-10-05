// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

/// @title MockUSDC
/// @notice Test-only USDC stand-in for Monad Testnet.
///
/// Exists because the demo must not be gated on an external faucet. `mint` is
/// deliberately unrestricted — this contract is for testnet only and must never
/// be deployed anywhere holding real value.
///
/// 6 decimals to match real USDC, so the 6-vs-18 decimal conversion in the perp
/// module is exercised in tests rather than only in production.
contract MockUSDC {
    string public constant name = "Mock USD Coin";
    string public constant symbol = "mUSDC";
    uint8 public constant decimals = 6;

    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) external {
        require(to != address(0), "mint to zero address");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    /// @notice Convenience for seeding demo accounts.
    function mintTo(address[] calldata recipients, uint256 amount) external {
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "mint to zero address");
            totalSupply += amount;
            balanceOf[recipients[i]] += amount;
            emit Transfer(address(0), recipients[i], amount);
        }
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "insufficient allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "transfer to zero address");
        require(balanceOf[from] >= amount, "insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
