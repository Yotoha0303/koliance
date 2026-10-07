// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

import {IVault} from "./interfaces/IVault.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IPositionManager} from "./interfaces/IPositionManager.sol";
import {Ownable} from "./utils/Ownable.sol";
import {SafeCast} from "./utils/SafeCast.sol";
import {PerpConstants} from "./PerpConstants.sol";

/// @title Vault
/// @notice Liquidity pool that acts as the counterparty to every position (GMX v1 style).
///
/// LPs deposit USDC and receive shares. Traders post collateral against the pool.
/// A winning trader is paid out of the pool; a losing one leaves collateral behind.
///
/// Two units are in play and mixing them up is the main hazard here:
///
///   - USDC, 6 decimals — what actually sits in this contract
///   - USD, 18 decimals — the internal unit for all PnL and margin math
///
/// `totalAssets()` reports 18-decimal USD; use `usdcBalance()` to read the raw token
/// amount. Share accounting is 18-decimal and independent of the token's precision.
///
/// Solvency: withdrawals are capped at `totalAssets() - reservedAssets()`, where the
/// reserve is whatever the PositionManager reports it may owe open positions. A pool
/// that cannot pay must revert, never settle a shortfall by minting value.
contract Vault is IVault, Ownable {
    using SafeCast for uint256;

    /// @notice Collateral token (USDC, or MockUSDC on testnet).
    IERC20 public immutable asset;

    /// @notice 18/6 — multiplier converting USDC amounts to internal USD.
    uint256 public immutable usdcToUsdScale;

    /// @notice Total LP shares outstanding, 18 decimals.
    uint256 public totalShares;

    /// @notice LP shares per provider.
    mapping(address => uint256) public sharesOf;

    /// @notice Fees booked via {receiveFees}, for reporting. These are not held
    /// separately — see the note on {receiveFees}.
    uint256 public accumulatedFees;

    /// @notice The only address allowed to move funds out via {payOut}.
    address public positionManager;

    error ZeroAmount();
    error ZeroShares();
    error InvalidAssetDecimals(uint8 decimals);
    error PositionManagerAlreadySet();
    error NotPositionManager(address caller);
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error TransferFailed();
    error InsufficientShares(uint256 requested, uint256 held);

    constructor(address asset_, address owner_) Ownable() {
        if (asset_ == address(0)) revert ZeroAddress();
        asset = IERC20(asset_);

        uint8 dec = IERC20(asset_).decimals();
        if (dec != PerpConstants.USDC_DECIMALS) revert InvalidAssetDecimals(dec);
        usdcToUsdScale = 10 ** (PerpConstants.USD_DECIMALS - dec);

        // Ownable's constructor sets owner = msg.sender; allow an explicit owner so
        // the deploy script can hand it to a different account immediately.
        if (owner_ != msg.sender) {
            if (owner_ == address(0)) revert ZeroAddress();
            emit OwnershipTransferred(msg.sender, owner_);
            owner = owner_;
        }
    }

    // ==================== WIRING ====================

    /// @inheritdoc IVault
    function setPositionManager(address positionManager_) external onlyOwner {
        if (positionManager != address(0)) revert PositionManagerAlreadySet();
        if (positionManager_ == address(0)) revert ZeroAddress();
        positionManager = positionManager_;
        emit PositionManagerSet(positionManager_);
    }

    modifier onlyPositionManager() {
        if (msg.sender != positionManager || positionManager == address(0)) {
            revert NotPositionManager(msg.sender);
        }
        _;
    }

    // ==================== UNITS ====================

    /// @notice Raw USDC balance held by this contract (6 decimals).
    function usdcBalance() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    /// @notice Convert an 18-decimal USD amount to its 6-decimal USDC equivalent.
    /// @dev Truncates. Rounding down is the conservative direction for payouts.
    function usdToUsdc(uint256 usdAmount) public view returns (uint256) {
        return usdAmount / usdcToUsdScale;
    }

    /// @notice Convert a 6-decimal USDC amount to 18-decimal USD.
    function usdcToUsd(uint256 usdcAmount) public view returns (uint256) {
        return usdcAmount * usdcToUsdScale;
    }

    // ==================== LP ====================

    /// @inheritdoc IVault
    function addLiquidity(uint256 amount) external returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();

        // Shares are minted against the pool's value BEFORE this deposit, so a
        // deposit cannot dilute existing LPs by counting itself as backing.
        uint256 assetsBefore = totalAssets();
        shares = totalShares == 0 ? usdcToUsd(amount) : (usdcToUsd(amount) * totalShares) / assetsBefore;
        if (shares == 0) revert ZeroShares();

        if (!asset.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        totalShares += shares;
        sharesOf[msg.sender] += shares;

        emit LiquidityAdded(msg.sender, amount, shares);
    }

    /// @inheritdoc IVault
    function removeLiquidity(uint256 shares) external returns (uint256 amount) {
        uint256 held = sharesOf[msg.sender];
        if (shares == 0) revert ZeroShares();
        if (shares > held) revert InsufficientShares(shares, held);

        uint256 assets = totalAssets();
        uint256 grossUsd = (assets * shares) / totalShares;

        // LPs may only take what is not needed to back open positions. Without this
        // an LP could drain the collateral behind live trades and leave winning
        // traders unpaid.
        uint256 reserved = _reservedAssets();
        uint256 available = assets > reserved ? assets - reserved : 0;
        if (grossUsd > available) revert InsufficientLiquidity(grossUsd, available);

        amount = usdToUsdc(grossUsd);
        if (amount == 0) revert ZeroAmount();

        totalShares -= shares;
        sharesOf[msg.sender] -= shares;
        if (!asset.transfer(msg.sender, amount)) revert TransferFailed();

        emit LiquidityRemoved(msg.sender, shares, amount);
    }

    /// @inheritdoc IVault
    function totalAssets() public view returns (uint256) {
        return usdcToUsd(usdcBalance());
    }

    // ==================== POSITION MANAGER ====================

    /// @inheritdoc IVault
    function payOut(address to, uint256 amount) external onlyPositionManager {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 usdcAmount = usdToUsdc(amount);
        if (usdcAmount == 0) revert ZeroAmount();

        // Solvency guard. `amount` is in 18-decimal USD; compare in USD so the
        // truncation above cannot let a payout slip past the balance check.
        uint256 balanceUsd = totalAssets();
        if (usdcToUsd(usdcAmount) > balanceUsd) {
            revert InsufficientLiquidity(usdcAmount, usdcBalance());
        }

        if (!asset.transfer(to, usdcAmount)) revert TransferFailed();
        emit PaidOut(to, usdcAmount);
    }

    /// @inheritdoc IVault
    /// @dev Trading collateral already lives in this contract, so a close that pays
    ///      out less than it collected simply leaves the difference here. This
    ///      function therefore records the fee for reporting only and moves no
    ///      funds. Keeping it as a separate call (rather than silent accrual) makes
    ///      the fee flow visible to the indexer.
    function receiveFees(uint256 amount) external onlyPositionManager {
        accumulatedFees += amount;
        emit FeesReceived(amount);
    }

    /// @notice What the pool must keep to honour open positions, in 18-decimal USD.
    /// @dev Zero before the PositionManager is wired — nothing is open yet.
    function _reservedAssets() internal view returns (uint256) {
        if (positionManager == address(0)) return 0;
        return IPositionManager(positionManager).reservedAssets();
    }

    /// @notice Public view of the reserve, for the UI to show locked liquidity.
    function reservedAssets() external view returns (uint256) {
        return _reservedAssets();
    }

    /// @notice Assets an LP could withdraw right now, in 18-decimal USD.
    function availableAssets() external view returns (uint256) {
        uint256 assets = totalAssets();
        uint256 reserved = _reservedAssets();
        return assets > reserved ? assets - reserved : 0;
    }
}
