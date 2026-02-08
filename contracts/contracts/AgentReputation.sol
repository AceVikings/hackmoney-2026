// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentReputation
 * @dev Implementation of EIP-8004 Reputation Registry.
 * Stores score updates from the Validation Registry or authorized controllers.
 */
contract AgentReputation is Ownable {
    struct Reputation {
        uint256 score; // 0-100 scale
        uint256 successfulTasks;
        uint256 reversedTasks;
        uint256 lastUpdate;
    }

    mapping(uint256 => Reputation) public agentReputation;
    mapping(address => bool) public authorizedControllers;

    event ReputationUpdated(uint256 indexed agentId, uint256 newScore);

    constructor() Ownable(msg.sender) {}

    modifier onlyAuthorized() {
        require(authorizedControllers[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    function setAuthorizedController(address controller, bool status) external onlyOwner {
        authorizedControllers[controller] = status;
    }

    function recordResult(uint256 agentId, bool success) external onlyAuthorized {
        Reputation storage rep = agentReputation[agentId];
        
        if (success) {
            rep.successfulTasks++;
            // Simple linear increase capping at 100
            if (rep.score < 100) rep.score += 1;
        } else {
            rep.reversedTasks++;
            // Slashing reputation on reversal
            if (rep.score > 5) rep.score -= 5;
            else rep.score = 0;
        }
        
        rep.lastUpdate = block.timestamp;
        emit ReputationUpdated(agentId, rep.score);
    }

    function getReputation(uint256 agentId) external view returns (uint256 score, uint256 success, uint256 failure) {
        Reputation memory rep = agentReputation[agentId];
        return (rep.score == 0 && rep.successfulTasks == 0 ? 50 : rep.score, rep.successfulTasks, rep.reversedTasks);
    }
}
