// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

/**
 * @title ACNSubnameRegistrar
 * @dev ENS subname registrar for the ACN (Agent Commitment Network).
 *      Deployed on Ethereum Sepolia where the official ENS NameWrapper lives.
 *
 *      This contract manages subnames of "acn.eth" using the real ENS
 *      NameWrapper (https://docs.ens.domains/wrapper/creating-subname-registrar).
 *
 *      Architecture:
 *        - The acn.eth owner approves this contract via
 *          NameWrapper.setApprovalForAll(registrar, true)
 *        - The registrar calls NameWrapper.setSubnodeRecord() to create subnames
 *        - The registrar keeps itself as the subname owner so it can manage
 *          text records (reputation, role, skills) on the PublicResolver
 *        - Agent wallet addresses are stored via resolver.setAddr()
 *
 *      ENS Sepolia Addresses:
 *        NameWrapper:    0x0635513f179D50A207757E05759CbD106d7dFcE8
 *        PublicResolver: 0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5
 *        acn.eth node:   0xb2423a11e21dd91238bf981679863591854b7bf82db6b1b9cfa3965a910cae8d
 *
 *      Text record keys follow ENS conventions (ENSIP-5):
 *        "acn.reputation"      — reputation score (0-100)
 *        "acn.role"            — agent role
 *        "acn.skills"          — comma-separated skills
 *        "acn.tasksCompleted"  — total completed tasks
 *        "acn.tasksFailed"     — total failed tasks
 *        "description"         — agent description
 */

// ── Minimal interfaces for ENS contracts on Sepolia ──

interface INameWrapper {
    function setSubnodeOwner(
        bytes32 parentNode,
        string calldata label,
        address owner,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32);

    function setSubnodeRecord(
        bytes32 parentNode,
        string memory label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32);

    function ownerOf(uint256 id) external view returns (address);

    function getData(uint256 id) external view returns (address owner, uint32 fuses, uint64 expiry);

    function isApprovedForAll(address account, address operator) external view returns (bool);
}

interface IPublicResolver {
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function text(bytes32 node, string calldata key) external view returns (string memory);
    function setAddr(bytes32 node, address addr) external;
    function addr(bytes32 node) external view returns (address payable);
}

// ── Contract ──

contract ACNSubnameRegistrar is ERC1155Holder {
    // ── State ──

    address public owner;
    INameWrapper public immutable nameWrapper;
    IPublicResolver public immutable resolver;
    bytes32 public immutable parentNode; // namehash("acn.eth")

    /// @dev node → registered flag
    mapping(bytes32 => bool) public registered;

    /// @dev node → label string (for reverse lookups)
    mapping(bytes32 => string) public nodeToLabel;

    /// @dev node → agent wallet address
    mapping(bytes32 => address) public nodeToAgent;

    uint256 public totalRegistered;

    // ── Events ──

    event SubnameRegistered(
        bytes32 indexed node,
        string label,
        address indexed agentWallet
    );

    event TextRecordSet(
        bytes32 indexed node,
        string key,
        string value
    );

    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    // ── Modifiers ──

    modifier onlyOwner() {
        require(msg.sender == owner, "ACNRegistrar: not owner");
        _;
    }

    // ── Constructor ──

    /**
     * @param _nameWrapper  ENS NameWrapper on Sepolia (0x0635513f179D50A207757E05759CbD106d7dFcE8)
     * @param _resolver     ENS PublicResolver on Sepolia (0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5)
     * @param _parentNode   Namehash of "acn.eth" (0xb2423a11e21dd91238bf981679863591854b7bf82db6b1b9cfa3965a910cae8d)
     */
    constructor(
        address _nameWrapper,
        address _resolver,
        bytes32 _parentNode
    ) {
        owner = msg.sender;
        nameWrapper = INameWrapper(_nameWrapper);
        resolver = IPublicResolver(_resolver);
        parentNode = _parentNode;
    }

    // ══════════════════════════════════════════════════════
    //  Subname Registration
    // ══════════════════════════════════════════════════════

    /**
     * @dev Register a new subname under acn.eth.
     *
     *      Following the ENS subname registrar pattern from the official docs:
     *        https://docs.ens.domains/wrapper/creating-subname-registrar
     *
     *      Flow:
     *        1. Call NameWrapper.setSubnodeRecord() with this contract as owner
     *           (so we can set resolver records)
     *        2. Call resolver.setText() for each initial text record
     *        3. Call resolver.setAddr() to store the agent's wallet
     *        4. Keep this contract as the NameWrapper owner for ongoing management
     *
     *      Requires: acn.eth owner has called NameWrapper.setApprovalForAll(this, true)
     *
     * @param label        The subname label (e.g. "summariser" for summariser.acn.eth)
     * @param agentWallet  The agent's wallet address
     * @param keys         Initial text record keys to set
     * @param values       Initial text record values to set
     * @return node        The namehash of the newly created subname
     */
    function register(
        string calldata label,
        address agentWallet,
        string[] calldata keys,
        string[] calldata values
    ) external onlyOwner returns (bytes32 node) {
        require(agentWallet != address(0), "ACNRegistrar: zero address");
        require(keys.length == values.length, "ACNRegistrar: length mismatch");

        // Step 1: Create the subname via NameWrapper.setSubnodeRecord
        //   - owner = address(this) → we become the subname owner (needed for resolver auth)
        //   - resolver = PublicResolver
        //   - fuses = 0 → no fuses burned, parent retains full control
        //   - expiry = max → NameWrapper normalizes to parent's expiry
        node = nameWrapper.setSubnodeRecord(
            parentNode,
            label,
            address(this),           // This contract becomes the subname owner
            address(resolver),       // Set the Public Resolver
            0,                       // TTL
            0,                       // No fuses burned
            type(uint64).max         // Max expiry (normalized by NameWrapper)
        );

        require(!registered[node], "ACNRegistrar: already registered");

        // Step 2: Set text records (authorized because we own the subname)
        for (uint256 i = 0; i < keys.length; i++) {
            resolver.setText(node, keys[i], values[i]);
            emit TextRecordSet(node, keys[i], values[i]);
        }

        // Step 3: Set the agent's wallet as the ETH address record
        resolver.setAddr(node, agentWallet);

        // Track registration
        registered[node] = true;
        nodeToLabel[node] = label;
        nodeToAgent[node] = agentWallet;
        totalRegistered++;

        emit SubnameRegistered(node, label, agentWallet);
    }

    // ══════════════════════════════════════════════════════
    //  Text Records (ENSIP-5 interface)
    // ══════════════════════════════════════════════════════

    /**
     * @dev Set a text record on a subname's resolver.
     *      Only callable by the contract owner (backend).
     *      Authorized because this contract is the NameWrapper owner of the subname.
     */
    function setText(
        bytes32 node,
        string calldata key,
        string calldata value
    ) external onlyOwner {
        require(registered[node], "ACNRegistrar: not registered");
        resolver.setText(node, key, value);
        emit TextRecordSet(node, key, value);
    }

    /**
     * @dev Batch-set multiple text records in one transaction.
     */
    function setTexts(
        bytes32 node,
        string[] calldata keys,
        string[] calldata values
    ) external onlyOwner {
        require(registered[node], "ACNRegistrar: not registered");
        require(keys.length == values.length, "ACNRegistrar: length mismatch");

        for (uint256 i = 0; i < keys.length; i++) {
            resolver.setText(node, keys[i], values[i]);
            emit TextRecordSet(node, keys[i], values[i]);
        }
    }

    // ══════════════════════════════════════════════════════
    //  View helpers
    // ══════════════════════════════════════════════════════

    /**
     * @dev Read a text record from the resolver (convenience wrapper).
     */
    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return resolver.text(node, key);
    }

    /**
     * @dev Check if a subname label is registered.
     */
    function isRegistered(bytes32 node) external view returns (bool) {
        return registered[node];
    }

    /**
     * @dev Get the agent wallet for a registered subname.
     */
    function getAgent(bytes32 node) external view returns (address) {
        return nodeToAgent[node];
    }

    /**
     * @dev Transfer contract ownership (for rotating the backend key).
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ACNRegistrar: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @dev ERC-165 supportsInterface — includes ERC1155Receiver + ITextResolver
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == 0x59d1d43c || // ITextResolver (setText)
            super.supportsInterface(interfaceId);
    }
}
