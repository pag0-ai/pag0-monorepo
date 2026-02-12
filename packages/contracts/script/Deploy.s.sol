// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {ValidationRegistry} from "../src/ValidationRegistry.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        ReputationRegistry reputation = new ReputationRegistry();
        console.log("ReputationRegistry deployed at:", address(reputation));

        ValidationRegistry validation = new ValidationRegistry();
        console.log("ValidationRegistry deployed at:", address(validation));

        vm.stopBroadcast();

        // Write deployment addresses to JSON
        string memory json = "deployments";
        vm.serializeAddress(json, "ReputationRegistry", address(reputation));
        string memory output = vm.serializeAddress(json, "ValidationRegistry", address(validation));
        vm.writeJson(output, "./deployments.json");
    }
}
