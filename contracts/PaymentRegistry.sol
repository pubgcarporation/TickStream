// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title TickStream payment registry
/// @notice Records operator-reported payments; amounts are USDC base units (6 decimals).
/// @dev Session IDs are metadata, not unique payment identifiers; repeated sessions are allowed.
contract PaymentRegistry is Ownable2Step {
    error ZeroAddress();
    error ZeroAmount();
    error UnauthorizedOperator(address caller);

    mapping(address => bool) public operators;
    mapping(address => uint256) public totalPaidToCreator;
    mapping(bytes32 => uint256) public totalPaidForVideo;
    uint256 public paymentCount;

    event OperatorSet(address indexed operator, bool allowed);
    event PaymentRecorded(
        bytes32 indexed sessionId,
        bytes32 indexed videoId,
        address indexed payer,
        address creator,
        uint256 amount
    );

    /// @param initialOwner Initial administrator; ownership transfers require acceptance.
    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Grants or revokes permission to record payments.
    function setOperator(address operator, bool allowed) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    /// @notice Records a payment and updates cumulative payment statistics.
    /// @dev Only trusted operators may report payments; this function does not move tokens.
    function record(
        bytes32 sessionId,
        bytes32 videoId,
        address payer,
        address creator,
        uint256 amount
    ) external {
        if (!operators[msg.sender]) revert UnauthorizedOperator(msg.sender);
        if (payer == address(0) || creator == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        totalPaidToCreator[creator] += amount;
        totalPaidForVideo[videoId] += amount;
        paymentCount += 1;
        emit PaymentRecorded(sessionId, videoId, payer, creator, amount);
    }
}
