// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ACNEscrow
 * @dev Simple escrow vault for ACN job payments on Arc testnet.
 *      Arc uses native USDC (18 decimals) as the gas token,
 *      so deposits are plain msg.value transfers.
 *
 *      Flow:
 *        1. Creator calls deposit(taskId) with value → funds locked
 *        2. On successful work → owner calls release(taskId, recipient)
 *        3. On failure / cancel → owner calls refund(taskId)
 */
contract ACNEscrow {
    address public owner;

    struct Escrow {
        address depositor;
        uint256 amount;
        bool released;
        bool refunded;
    }

    mapping(bytes32 => Escrow) public escrows;

    event Deposited(bytes32 indexed taskId, address indexed depositor, uint256 amount);
    event Released(bytes32 indexed taskId, address indexed recipient, uint256 amount);
    event Refunded(bytes32 indexed taskId, address indexed depositor, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Lock native USDC for a task.
     */
    function deposit(bytes32 taskId) external payable {
        require(msg.value > 0, "No value sent");
        require(escrows[taskId].amount == 0, "Already deposited");

        escrows[taskId] = Escrow({
            depositor: msg.sender,
            amount: msg.value,
            released: false,
            refunded: false
        });

        emit Deposited(taskId, msg.sender, msg.value);
    }

    /**
     * @dev Release escrowed funds to the recipient (agent / settlement).
     *      Only the contract owner (ACN backend) can call this.
     */
    function release(bytes32 taskId, address payable recipient) external onlyOwner {
        Escrow storage e = escrows[taskId];
        require(e.amount > 0, "No escrow");
        require(!e.released && !e.refunded, "Already settled");

        e.released = true;
        (bool ok, ) = recipient.call{value: e.amount}("");
        require(ok, "Transfer failed");

        emit Released(taskId, recipient, e.amount);
    }

    /**
     * @dev Refund escrowed funds back to the depositor.
     *      Only the contract owner (ACN backend) can call this.
     */
    function refund(bytes32 taskId) external onlyOwner {
        Escrow storage e = escrows[taskId];
        require(e.amount > 0, "No escrow");
        require(!e.released && !e.refunded, "Already settled");

        e.refunded = true;
        (bool ok, ) = payable(e.depositor).call{value: e.amount}("");
        require(ok, "Transfer failed");

        emit Refunded(taskId, e.depositor, e.amount);
    }

    /**
     * @dev View escrow details.
     */
    function getEscrow(bytes32 taskId) external view returns (
        address depositor,
        uint256 amount,
        bool released,
        bool refunded
    ) {
        Escrow storage e = escrows[taskId];
        return (e.depositor, e.amount, e.released, e.refunded);
    }
}
