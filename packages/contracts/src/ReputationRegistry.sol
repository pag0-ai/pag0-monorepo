// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ReputationRegistry {
    event FeedbackGiven(
        string indexed agentId,
        uint256 value,
        bytes32 tag1,
        bytes32 tag2,
        string feedbackURI,
        bytes32 feedbackHash
    );

    function giveFeedback(
        string calldata agentId,
        uint256 value,
        uint8 valueDecimals,
        bytes32 tag1,
        bytes32 tag2,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        emit FeedbackGiven(agentId, value, tag1, tag2, feedbackURI, feedbackHash);
    }
}
