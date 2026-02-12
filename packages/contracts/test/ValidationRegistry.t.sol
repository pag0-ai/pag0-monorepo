// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {ValidationRegistry} from "../src/ValidationRegistry.sol";

contract ValidationRegistryTest is Test {
    ValidationRegistry registry;

    function setUp() public {
        registry = new ValidationRegistry();
    }

    event ValidationRequested(
        string indexed agentId,
        bytes data,
        uint256 timestamp
    );

    function test_validationRequest_emitsEvent() public {
        bytes memory data = abi.encode("test-validation-data");

        vm.expectEmit(false, false, false, true);
        emit ValidationRequested(
            "agent-001",
            data,
            block.timestamp
        );

        registry.validationRequest("agent-001", data);
    }
}
