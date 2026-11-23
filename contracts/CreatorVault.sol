// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TickStream creator earnings vault
/// @notice Holds earned USDC; all amounts are base units (6 decimals).
/// @dev Configure genuine, non-rebasing, non-fee-on-transfer USDC.
///      Withdrawers are trusted to debit creators and choose their payment destinations.
contract CreatorVault is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error ZeroAmount();
    error UnauthorizedOperator(address caller);
    error UnauthorizedWithdrawer(address caller);
    error InsufficientBalance(uint256 available, uint256 requested);

    IERC20 public immutable usdc;
    mapping(address => bool) public operators;
    mapping(address => bool) public withdrawers;
    mapping(address => uint256) public balanceOf;

    event VaultConfigured(address indexed usdc);
    event OperatorSet(address indexed operator, bool allowed);
    event WithdrawerSet(address indexed withdrawer, bool allowed);
    event Credited(address indexed operator, address indexed creator, uint256 amount);
    event Withdrawn(address indexed creator, address indexed to, address indexed caller, uint256 amount);

    /// @param usdc_ USDC ERC-20 address (6 decimals).
    /// @param initialOwner Initial administrator of operators and withdrawers.
    constructor(address usdc_, address initialOwner) Ownable(initialOwner) {
        if (usdc_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
        emit VaultConfigured(usdc_);
    }

    modifier onlyOperator() {
        if (!operators[msg.sender]) revert UnauthorizedOperator(msg.sender);
        _;
    }

    modifier onlyWithdrawer() {
        if (!withdrawers[msg.sender]) revert UnauthorizedWithdrawer(msg.sender);
        _;
    }

    /// @notice Grants or revokes permission to fund creator balances.
    function setOperator(address operator, bool allowed) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    /// @notice Grants or revokes trusted access to creator withdrawals.
    function setWithdrawer(address withdrawer, bool allowed) external onlyOwner {
        if (withdrawer == address(0)) revert ZeroAddress();
        withdrawers[withdrawer] = allowed;
        emit WithdrawerSet(withdrawer, allowed);
    }

    /// @notice Credits a creator by pulling approved USDC from the calling operator.
    function credit(address creator, uint256 amount) external onlyOperator nonReentrant {
        if (creator == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        balanceOf[creator] += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Credited(msg.sender, creator, amount);
    }

    /// @notice Withdraws the caller's earned USDC to their own address.
    function withdraw(uint256 amount) external nonReentrant {
        _withdraw(msg.sender, amount, msg.sender);
    }

    /// @notice Allows a trusted withdrawer to withdraw for the actual creator.
    /// @dev The distributor must pass its creator caller, not its own address, as creator.
    function withdrawFor(address creator, uint256 amount, address to) external onlyWithdrawer nonReentrant {
        _withdraw(creator, amount, to);
    }

    function _withdraw(address creator, uint256 amount, address to) private {
        if (creator == address(0) || to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        uint256 available = balanceOf[creator];
        if (amount > available) revert InsufficientBalance(available, amount);
        balanceOf[creator] = available - amount;
        usdc.safeTransfer(to, amount);
        emit Withdrawn(creator, to, msg.sender, amount);
    }
}
