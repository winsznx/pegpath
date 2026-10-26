// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PegPathRedeemer, IERC20Permit, ITroveManager, IHintHelpers, IPriceFeed} from "../src/PegPathRedeemer.sol";

/// Mezo's BTC/USD oracle is a chain precompile anvil can't run, so fork tests etch this stand-in at its
/// address. It reports MEZO_PRICE (read from the live PriceFeed before the run) with a fresh timestamp.
contract OracleStub {
    int256 public answer;
    uint256 public updatedAt;

    function set(int256 a, uint256 t) external {
        answer = a;
        updatedAt = t;
    }

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}

contract PegPathRedeemerForkTest is Test {
    IERC20Permit constant MUSD = IERC20Permit(0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503);
    ITroveManager constant TM = ITroveManager(0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0);
    IHintHelpers constant HH = IHintHelpers(0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6);
    IPriceFeed constant PF = IPriceFeed(0x86bCF0841622a5dAC14A313a15f96A95421b9366);
    address constant ORACLE = 0x7b7c000000000000000000000000000000000015;
    // EOA holding testnet MUSD. Impersonated on the fork only.
    address constant HOLDER = 0x401d68969c9afAdeEc0e9fE6B67221247CFa642F;
    address constant UPPER = 0xDA04759E54728B6636Fe48F7c9795c7B609bAaAa;

    PegPathRedeemer redeemer;
    OracleStub stub;

    function setUp() public {
        uint256 forkBlock = vm.envOr("MEZO_FORK_BLOCK", uint256(0));
        if (forkBlock == 0) vm.createSelectFork("mezo_testnet");
        else vm.createSelectFork("mezo_testnet", forkBlock);
        uint256 price = vm.envUint("MEZO_PRICE");
        vm.etch(ORACLE, type(OracleStub).runtimeCode);
        stub = OracleStub(ORACLE);
        stub.set(int256(price), block.timestamp);
        redeemer = new PegPathRedeemer(MUSD, TM, HH, PF);
    }

    function _expected(uint256 amount) internal view returns (uint256) {
        (,, uint256 truncated) = HH.getRedemptionHints(amount, PF.fetchPrice(), 1);
        return truncated < amount ? truncated : amount;
    }

    function _setPrice(uint256 p) internal {
        stub.set(int256(p), block.timestamp);
    }

    function test_redeemsWithHintsComputedInTheSameTransaction() public {
        uint256 amount = 10e18;
        uint256 expected = _expected(amount);
        uint256 btcBefore = HOLDER.balance;
        uint256 musdBefore = MUSD.balanceOf(HOLDER);

        vm.startPrank(HOLDER);
        IERC20PermitApprove(address(MUSD)).approve(address(redeemer), amount);
        (uint256 redeemed, uint256 btc) = redeemer.redeem(amount, UPPER, address(0), 1, 1, block.timestamp + 60);
        vm.stopPrank();

        assertEq(redeemed, expected);
        assertGt(btc, 0);
        assertEq(HOLDER.balance - btcBefore, btc);
        assertEq(musdBefore - MUSD.balanceOf(HOLDER), redeemed);
        assertEq(address(redeemer).balance, 0);
        assertEq(MUSD.balanceOf(address(redeemer)), 0);
    }

    /// The failure PegPath measured live: an off-chain NICR hint for 10 MUSD dies on a tiny price tick.
    function test_directCallWithStaleHintRevertsButRedeemerSucceeds() public {
        uint256 amount = 10e18;
        uint256 price = PF.fetchPrice();
        (address first, uint256 nicr, uint256 truncated) = HH.getRedemptionHints(amount, price, 1);
        amount = truncated; // what an off-chain client would submit after truncation

        _setPrice(price + price / 10_000); // +0.01%, under one testnet block of movement

        vm.prank(HOLDER);
        vm.expectRevert(bytes("TroveManager: Unable to redeem any amount"));
        TM.redeemCollateral(amount, first, UPPER, address(0), nicr, 1);

        uint256 expected = _expected(amount);
        vm.startPrank(HOLDER);
        IERC20PermitApprove(address(MUSD)).approve(address(redeemer), amount);
        (uint256 redeemed,) = redeemer.redeem(amount, UPPER, address(0), 1, 1, block.timestamp + 60);
        vm.stopPrank();
        assertEq(redeemed, expected);
        assertGt(redeemed, 0);
    }

    function test_returnsUnredeemedMusd() public {
        uint256 amount = 1_000e18; // far more than one partial can take
        uint256 expected = _expected(amount);
        uint256 musdBefore = MUSD.balanceOf(HOLDER);
        vm.startPrank(HOLDER);
        IERC20PermitApprove(address(MUSD)).approve(address(redeemer), amount);
        (uint256 redeemed,) = redeemer.redeem(amount, UPPER, address(0), 1, 1, block.timestamp + 60);
        vm.stopPrank();
        assertEq(redeemed, expected);
        assertLt(redeemed, amount);
        assertEq(musdBefore - MUSD.balanceOf(HOLDER), redeemed);
        assertEq(MUSD.balanceOf(address(redeemer)), 0);
    }

    function test_enforcesMinimumBtc() public {
        vm.startPrank(HOLDER);
        IERC20PermitApprove(address(MUSD)).approve(address(redeemer), 10e18);
        vm.expectRevert();
        redeemer.redeem(10e18, UPPER, address(0), 1, 1 ether, block.timestamp + 60);
        vm.stopPrank();
    }

    function test_rejectsExpiredDeadline() public {
        vm.prank(HOLDER);
        vm.expectRevert(PegPathRedeemer.Expired.selector);
        redeemer.redeem(1e18, UPPER, address(0), 1, 0, block.timestamp - 1);
    }

    function test_refusesStrayBtc() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(redeemer).call{value: 1}("");
        assertFalse(ok);
    }
}

interface IERC20PermitApprove {
    function approve(address spender, uint256 amount) external returns (bool);
}
