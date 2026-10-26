// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PegPathRedeemer, IERC20Permit, ITroveManager, IHintHelpers, IPriceFeed} from "../src/PegPathRedeemer.sol";

/// Deploys PegPathRedeemer against the Mezo Testnet MUSD deployment (addresses match
/// the musd-contracts npm package, deployments/matsnet).
contract Deploy is Script {
    function run() external returns (PegPathRedeemer redeemer) {
        require(block.chainid == 31611, "Mezo Testnet only");
        vm.startBroadcast();
        redeemer = new PegPathRedeemer(
            IERC20Permit(0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503),
            ITroveManager(0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0),
            IHintHelpers(0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6),
            IPriceFeed(0x86bCF0841622a5dAC14A313a15f96A95421b9366)
        );
        vm.stopBroadcast();
        console2.log("PegPathRedeemer", address(redeemer));
    }
}
