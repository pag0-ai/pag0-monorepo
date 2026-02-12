// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

contract ReputationRegistryTest is Test {
    ReputationRegistry registry;

    function setUp() public {
        registry = new ReputationRegistry();
    }

    event FeedbackGiven(
        string indexed agentId,
        uint256 value,
        bytes32 tag1,
        bytes32 tag2,
        string feedbackURI,
        bytes32 feedbackHash
    );

    function test_giveFeedback_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit FeedbackGiven(
            "agent-001",
            1000000,
            bytes32("quality"),
            bytes32("speed"),
            "ipfs://QmTest",
            keccak256("feedback-data")
        );

        registry.giveFeedback(
            "agent-001",
            1000000,
            6,
            bytes32("quality"),
            bytes32("speed"),
            "ipfs://QmTest",
            keccak256("feedback-data")
        );
    }
}
