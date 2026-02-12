// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ValidationRegistry {
    event ValidationRequested(
        string indexed agentId,
        bytes data,
        uint256 timestamp
    );

    function validationRequest(
        string calldata agentId,
        bytes calldata data
    ) external {
        emit ValidationRequested(agentId, data, block.timestamp);
    }
}
