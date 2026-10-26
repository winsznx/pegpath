// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IERC20Permit {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external;
}

interface IPriceFeed {
    function fetchPrice() external view returns (uint256);
}

interface IHintHelpers {
    function getRedemptionHints(uint256 amount, uint256 price, uint256 maxIterations)
        external
        view
        returns (address firstRedemptionHint, uint256 partialRedemptionHintNICR, uint256 truncatedAmount);
}

interface ITroveManager {
    function redeemCollateral(
        uint256 amount,
        address firstRedemptionHint,
        address upperPartialRedemptionHint,
        address lowerPartialRedemptionHint,
        uint256 partialRedemptionHintNICR,
        uint256 maxIterations
    ) external;
}

/// @title PegPathRedeemer
/// @notice Redeems MUSD for BTC through Mezo's TroveManager with the first-redemption hint and the
/// partial-redemption NICR computed in the same transaction, at the oracle price the redemption itself
/// uses. A hint computed off-chain is invalidated by any BTC/USD tick before inclusion; computing it here
/// removes that race. Reinsert hints are only starting points for SortedTroves, so they still come from the caller.
/// @dev Holds no funds between transactions. Unredeemed MUSD and all BTC received go back to the caller in the
/// same call. BTC is only accepted while a redemption is in progress.
contract PegPathRedeemer {
    IERC20Permit public immutable musd;
    ITroveManager public immutable troveManager;
    IHintHelpers public immutable hintHelpers;
    IPriceFeed public immutable priceFeed;

    bool private redeeming;

    event Redeemed(
        address indexed redeemer, uint256 requested, uint256 redeemed, uint256 btcReceived, uint256 musdReturned
    );

    error NothingRedeemable();
    error InsufficientBtc(uint256 received, uint256 minimum);
    error Expired();
    error Reentrancy();
    error UnexpectedBtc();
    error TransferFailed();

    constructor(IERC20Permit musd_, ITroveManager troveManager_, IHintHelpers hintHelpers_, IPriceFeed priceFeed_) {
        musd = musd_;
        troveManager = troveManager_;
        hintHelpers = hintHelpers_;
        priceFeed = priceFeed_;
    }

    receive() external payable {
        if (!redeeming) revert UnexpectedBtc();
    }

    /// @notice Redeem `amount` MUSD the caller has approved to this contract.
    /// @param minBtcOut BTC the caller must receive after the protocol fee, or the whole call reverts.
    function redeem(
        uint256 amount,
        address upperPartialHint,
        address lowerPartialHint,
        uint256 maxIterations,
        uint256 minBtcOut,
        uint256 deadline
    ) external returns (uint256 redeemed, uint256 btcReceived) {
        return _redeem(amount, upperPartialHint, lowerPartialHint, maxIterations, minBtcOut, deadline);
    }

    /// @notice Same as `redeem`, authorising the MUSD pull with an EIP-2612 signature instead of an approval.
    /// @dev The permit is wrapped in try/catch so a front-run permit can't block the redemption; the pull still
    /// fails safely if no allowance exists.
    function redeemWithPermit(
        uint256 amount,
        address upperPartialHint,
        address lowerPartialHint,
        uint256 maxIterations,
        uint256 minBtcOut,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 redeemed, uint256 btcReceived) {
        try musd.permit(msg.sender, address(this), amount, deadline, v, r, s) {} catch {}
        return _redeem(amount, upperPartialHint, lowerPartialHint, maxIterations, minBtcOut, deadline);
    }

    /// @notice The hints this contract would use right now, for previews.
    function previewHints(uint256 amount, uint256 maxIterations)
        external
        view
        returns (address firstRedemptionHint, uint256 partialNICR, uint256 truncatedAmount, uint256 price)
    {
        price = priceFeed.fetchPrice();
        (firstRedemptionHint, partialNICR, truncatedAmount) =
            hintHelpers.getRedemptionHints(amount, price, maxIterations);
    }

    function _redeem(
        uint256 amount,
        address upperPartialHint,
        address lowerPartialHint,
        uint256 maxIterations,
        uint256 minBtcOut,
        uint256 deadline
    ) private returns (uint256 redeemed, uint256 btcReceived) {
        if (block.timestamp > deadline) revert Expired();
        if (redeeming) revert Reentrancy();
        redeeming = true;

        if (!musd.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        uint256 price = priceFeed.fetchPrice();
        (address first, uint256 nicr, uint256 truncated) = hintHelpers.getRedemptionHints(amount, price, maxIterations);
        uint256 toRedeem = truncated < amount ? truncated : amount;
        if (toRedeem == 0) revert NothingRedeemable();

        uint256 musdBefore = musd.balanceOf(address(this));
        uint256 btcBefore = address(this).balance;
        troveManager.redeemCollateral(toRedeem, first, upperPartialHint, lowerPartialHint, nicr, maxIterations);
        redeemed = musdBefore - musd.balanceOf(address(this));
        btcReceived = address(this).balance - btcBefore;

        if (redeemed == 0) revert NothingRedeemable();
        if (btcReceived < minBtcOut) revert InsufficientBtc(btcReceived, minBtcOut);

        uint256 leftover = musd.balanceOf(address(this));
        if (leftover > 0 && !musd.transfer(msg.sender, leftover)) revert TransferFailed();

        redeeming = false;

        (bool sent,) = msg.sender.call{value: btcReceived}("");
        if (!sent) revert TransferFailed();

        emit Redeemed(msg.sender, amount, redeemed, btcReceived, leftover);
    }
}
