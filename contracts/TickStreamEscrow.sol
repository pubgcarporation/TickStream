// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {CreatorVault} from "./CreatorVault.sol";
import {PaymentRegistry} from "./PaymentRegistry.sol";

/// @title TickStream viewer payment escrow
/// @notice Holds unspent viewer USDC, measured in base units (6 decimals).
/// @dev This escrow must be an operator on both the vault and registry before charging.
///      Configure the same genuine USDC token as the vault. Operators are trusted to
///      authorize correct usage charges. Pausing never prevents viewer withdrawals.
contract TickStreamEscrow is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error ZeroAmount();
    error UnauthorizedOperator(address caller);
    error InsufficientBalance(uint256 available, uint256 requested);
    error TokenMismatch();

    IERC20 public immutable usdc;
    CreatorVault public immutable vault;
    PaymentRegistry public immutable registry;
    mapping(address => bool) public operators;
    mapping(address => uint256) public balanceOf;

    event EscrowConfigured(address indexed usdc, address indexed vault, address indexed registry);
    event OperatorSet(address indexed operator, bool allowed);
    event Deposited(address indexed viewer, uint256 amount);
    event Withdrawn(address indexed viewer, uint256 amount);
    event Charged(
        address indexed viewer,
        bytes32 indexed sessionId,
        bytes32 indexed videoId,
        address creator,
        uint256 amount
    );

    /// @notice Sets immutable dependencies and the initial administrator.
    constructor(address usdc_, address vault_, address registry_, address initialOwner) Ownable(initialOwner) {
        if (usdc_ == address(0) || vault_ == address(0) || registry_ == address(0)) revert ZeroAddress();
        if (address(CreatorVault(vault_).usdc()) != usdc_) revert TokenMismatch();
        usdc = IERC20(usdc_);
        vault = CreatorVault(vault_);
        registry = PaymentRegistry(registry_);
        emit EscrowConfigured(usdc_, vault_, registry_);
    }

    /// @notice Grants or revokes permission to charge viewer balances.
    function setOperator(address operator, bool allowed) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    /// @notice Pauses deposits and charges, but not withdrawals.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resumes deposits and charges.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Deposits approved USDC into the caller's unspent balance.
    function deposit(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        balanceOf[msg.sender] += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /// @notice Withdraws the caller's own unspent balance, including while paused.
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 available = balanceOf[msg.sender];
        if (amount > available) revert InsufficientBalance(available, amount);
        balanceOf[msg.sender] = available - amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Atomically moves a viewer payment to the creator vault and records it.
    /// @dev Grants only the exact required allowance, then clears it after crediting.
    function charge(
        address viewer,
        bytes32 sessionId,
        bytes32 videoId,
        address creator,
        uint256 amount
    ) external whenNotPaused nonReentrant {
        if (!operators[msg.sender]) revert UnauthorizedOperator(msg.sender);
        if (viewer == address(0) || creator == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        uint256 available = balanceOf[viewer];
        if (amount > available) revert InsufficientBalance(available, amount);
        balanceOf[viewer] = available - amount;
        usdc.forceApprove(address(vault), amount);
        vault.credit(creator, amount);
        usdc.forceApprove(address(vault), 0);
        registry.record(sessionId, videoId, viewer, creator, amount);
        emit Charged(viewer, sessionId, videoId, creator, amount);
    }
}
