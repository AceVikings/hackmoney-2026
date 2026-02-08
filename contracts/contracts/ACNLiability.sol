// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AgentReputation.sol";

/**
 * @title ACNLiability
 * @dev Manages the Agent Commitment Network liability trees and settlement.
 */
contract ACNLiability is Ownable {
    IERC20 public immutable usdc;
    AgentReputation public immutable reputation;

    struct Task {
        address requester;
        uint256 budget;
        uint256 startTime;
        uint256 reversalWindow; // duration in seconds
        bool resolved;
    }

    struct Commitment {
        address parent;
        address agent;
        uint256 amount;
        uint256 taskStartTime;
        uint256 reversalDeadline;
        bool reversed;
        bool finalized;
    }

    mapping(bytes32 => Task) public tasks;
    mapping(bytes32 => Commitment) public commitments; // commitmentId = keccak256(taskId + agentAddress)

    event TaskCreated(bytes32 indexed taskId, address indexed requester, uint256 budget);
    event CommitmentCreated(bytes32 indexed taskId, address indexed parent, address indexed agent, uint256 amount);
    event CommitmentReversed(bytes32 indexed taskId, address indexed agent, uint256 amount);
    event Settled(bytes32 indexed taskId, address indexed agent, uint256 amount);

    constructor(address _usdc, address _reputation) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        reputation = AgentReputation(_reputation);
    }

    /**
     * @dev User creates a task and locks the budget.
     */
    function createTask(bytes32 taskId, uint256 budget, uint256 reversalWindow) external {
        require(budget > 0, "Budget must be > 0");
        require(tasks[taskId].startTime == 0, "Task already exists");

        usdc.transferFrom(msg.sender, address(this), budget);

        tasks[taskId] = Task({
            requester: msg.sender,
            budget: budget,
            startTime: block.timestamp,
            reversalWindow: reversalWindow,
            resolved: false
        });

        emit TaskCreated(taskId, msg.sender, budget);
    }

    /**
     * @dev Parent agent hires a sub-agent. Creates a liability edge.
     */
    function registerCommitment(
        bytes32 taskId,
        address agent,
        uint256 amount
    ) external {
        Task storage task = tasks[taskId];
        require(task.startTime > 0, "Task not found");
        require(!task.resolved, "Task resolved");

        bytes32 commitmentId = keccak256(abi.encodePacked(taskId, agent));
        require(commitments[commitmentId].agent == address(0), "Commitment exists");

        commitments[commitmentId] = Commitment({
            parent: msg.sender,
            agent: agent,
            amount: amount,
            taskStartTime: task.startTime,
            reversalDeadline: block.timestamp + task.reversalWindow,
            reversed: false,
            finalized: false
        });

        emit CommitmentCreated(taskId, msg.sender, agent, amount);
    }

    /**
     * @dev Parent agent reverses a commitment if sub-agent failed.
     */
    function reverseCommitment(bytes32 taskId, address agent) external {
        bytes32 commitmentId = keccak256(abi.encodePacked(taskId, agent));
        Commitment storage c = commitments[commitmentId];
        
        require(c.parent == msg.sender, "Not the parent");
        require(block.timestamp <= c.reversalDeadline, "Window closed");
        require(!c.reversed && !c.finalized, "Invalid state");

        c.reversed = true;
        
        // Update reputation
        uint256 agentId = 0; // In reality, fetch from IdentityRegistry
        // reputation.recordResult(agentId, false);

        emit CommitmentReversed(taskId, agent, c.amount);
    }

    /**
     * @dev Settle final balance. In ACN, settlement is net.
     */
    function settle(bytes32 taskId, address agent) external {
        bytes32 commitmentId = keccak256(abi.encodePacked(taskId, agent));
        Commitment storage c = commitments[commitmentId];

        require(!c.reversed, "Already reversed");
        require(!c.finalized, "Already finalized");
        require(block.timestamp > c.reversalDeadline, "Window still open");

        c.finalized = true;
        usdc.transfer(c.agent, c.amount);

        emit Settled(taskId, agent, c.amount);
    }
}
