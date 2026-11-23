// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {CreatorVault} from "./CreatorVault.sol";

/// @title TickStream collaborator revenue distributor
/// @notice Creators credit earned USDC using splits totaling 10,000 basis points; recipients claim independently.
/// @dev The vault owner must add this contract as a withdrawer. Configure the same
///      genuine USDC token (6 decimals) as the vault. No owner or platform fees exist.
contract RevenueDistributor is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error ZeroAmount();
    error InvalidSplitLength();
    error InvalidRecipient(address recipient);
    error DuplicateRecipient(address recipient);
    error ZeroBasisPoints();
    error InvalidBasisPointsTotal(uint256 total);
    error NoSplit(address creator);
    error TokenMismatch();

    struct Split {
        address[] recipients;
        uint16[] bps;
    }

    IERC20 public immutable usdc;
    CreatorVault public immutable vault;
    mapping(address => Split) private _splits;
    /// @notice Unclaimed USDC base units owed to each recipient across all creators.
    mapping(address => uint256) public claimable;

    event DistributorConfigured(address indexed usdc, address indexed vault);
    event SplitSet(address indexed creator, address[] recipients, uint16[] bps);
    event RecipientCredited(address indexed creator, address indexed recipient, uint256 amount);
    event Claimed(address indexed recipient, uint256 amount);
    event Distributed(address indexed creator, uint256 amount);

    /// @notice Sets immutable USDC and creator vault addresses.
    constructor(address usdc_, address vault_) {
        if (usdc_ == address(0) || vault_ == address(0)) revert ZeroAddress();
        if (address(CreatorVault(vault_).usdc()) != usdc_) revert TokenMismatch();
        usdc = IERC20(usdc_);
        vault = CreatorVault(vault_);
        emit DistributorConfigured(usdc_, vault_);
    }

    /// @notice Replaces the caller's split with 1..10 unique recipients totaling 10,000 bps.
    /// @dev This distributor cannot itself be a recipient, to avoid unclaimable credits.
    ///      Recipient transfer restrictions affect only their own claims, not distributions.
    function setSplit(address[] calldata recipients, uint16[] calldata bps) external nonReentrant {
        uint256 length = recipients.length;
        if (length == 0 || length > 10 || length != bps.length) revert InvalidSplitLength();
        uint256 total;
        for (uint256 i; i < length; ++i) {
            address recipient = recipients[i];
            if (recipient == address(0) || recipient == address(this)) revert InvalidRecipient(recipient);
            if (bps[i] == 0) revert ZeroBasisPoints();
            for (uint256 j; j < i; ++j) {
                if (recipients[j] == recipient) revert DuplicateRecipient(recipient);
            }
            total += bps[i];
        }
        if (total != 10_000) revert InvalidBasisPointsTotal(total);
        _splits[msg.sender] = Split({recipients: recipients, bps: bps});
        emit SplitSet(msg.sender, recipients, bps);
    }

    /// @notice Returns the configured recipients and basis points for a creator.
    function getSplit(address creator) external view returns (address[] memory recipients, uint16[] memory bps) {
        Split storage split = _splits[creator];
        return (split.recipients, split.bps);
    }

    /// @notice Withdraws the caller's earnings and credits their configured collaborators.
    /// @dev Every withdrawn base unit is credited; all rounding dust goes to recipient zero.
    ///      No recipient transfers occur here; recipients withdraw independently with claim().
    ///      Distributions and claims preserve backing equal to total unclaimed balances.
    ///      Unsolicited token transfers are extra backing, not part of a distribution.
    function distribute(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Split memory split = _splits[msg.sender];
        uint256 length = split.recipients.length;
        if (length == 0) revert NoSplit(msg.sender);

        uint256[] memory shares = new uint256[](length);
        uint256 allocated;
        for (uint256 i; i < length; ++i) {
            shares[i] = Math.mulDiv(amount, split.bps[i], 10_000);
            allocated += shares[i];
        }
        shares[0] += amount - allocated;

        vault.withdrawFor(msg.sender, amount, address(this));
        for (uint256 i; i < length; ++i) {
            claimable[split.recipients[i]] += shares[i];
            emit RecipientCredited(msg.sender, split.recipients[i], shares[i]);
        }
        emit Distributed(msg.sender, amount);
    }

    /// @notice Withdraws the caller's entire claimable USDC balance to their own address.
    /// @dev Clears credit before transferring; a failed transfer restores it by reverting
    ///      and does not affect any other recipient's ability to distribute or claim.
    function claim() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert ZeroAmount();
        claimable[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }
}
