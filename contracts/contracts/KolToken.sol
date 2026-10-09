// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

/// @title KolToken (KOL)
/// @notice Monad 链上代币，名称 kol，符号 KOL，总上限 2^30，每 2 年减半释放
contract KolToken {
    string public constant name = "kol";
    string public constant symbol = "KOL";
    uint8 public constant decimals = 18;

    // 总硬顶 2^30 * 1e18
    uint256 public constant MAX_SUPPLY = (2**30) * 1e18;
    // 2 年减半周期（秒）
    uint256 public constant HALVING_PERIOD = 730 days; 
    // 第一个 2 年周期的基础产出总量 (2^29 * 1e18)
    uint256 public constant BASE_ERA_SUPPLY = (2**29) * 1e18;

    uint256 public totalSupply;
    uint256 public immutable startTime;
    uint256 public lastClaimTime;

    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event BlockClaimed(address indexed miner, uint256 reward, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        startTime = block.timestamp;
        lastClaimTime = block.timestamp;
    }

    // ==================== 减半与区块奖励逻辑 ====================

    /// @notice 获取当前所处的减半纪元 (0 = 前2年, 1 = 2-4年, ...)
    function currentEra() public view returns (uint256) {
        return (block.timestamp - startTime) / HALVING_PERIOD;
    }

    /// @notice 获取当前每秒产出的代币数量 (按纪元减半)
    function currentRewardRatePerSecond() public view returns (uint256) {
        uint256 era = currentEra();
        if (era >= 30) return 0; // 30个周期后微量到可忽略，停止产出
        // 每秒产出 = (本纪元总量) / 730天
        return (BASE_ERA_SUPPLY >> era) / HALVING_PERIOD;
    }

    /// @notice 任何用户/矿工均可调用此方法“占领区块并领取奖励”
    function claimBlockReward() external returns (uint256 reward) {
        require(block.timestamp > lastClaimTime, "Already claimed in this block");
        
        uint256 elapsed = block.timestamp - lastClaimTime;
        reward = elapsed * currentRewardRatePerSecond();

        // 确保不超过硬顶
        if (totalSupply + reward > MAX_SUPPLY) {
            reward = MAX_SUPPLY - totalSupply;
        }

        require(reward > 0, "No reward available");

        lastClaimTime = block.timestamp;
        totalSupply += reward;
        balanceOf[msg.sender] += reward;

        emit Transfer(address(0), msg.sender, reward);
        emit BlockClaimed(msg.sender, reward, block.timestamp);
    }

    // ==================== 标准 ERC-20 转账功能 ====================

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
