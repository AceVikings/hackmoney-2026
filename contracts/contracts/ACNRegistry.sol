// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ACNRegistry
 * @dev ENS-inspired subname registrar with built-in text-record resolver
 *      for the ACN (Agent Commitment Network) on Arc testnet.
 *
 *      Inspired by:
 *        - ENS NameWrapper subname registrar pattern
 *          (https://docs.ens.domains/wrapper/creating-subname-registrar)
 *        - ENSIP-5 / ENSIP-18 text-record standard
 *          (https://docs.ens.domains/web/records#text-records)
 *
 *      Root domain: acn.eth (conceptual — self-contained on Arc)
 *
 *      Flow:
 *        1. Backend calls registerSubname("summariser", agentAddr)
 *           → mints "summariser.acn.eth" with agentAddr as owner
 *        2. Backend calls setText(node, key, value)
 *           → stores text records: reputation, role, skills, etc.
 *        3. Anyone can call text(node, key) to read records
 *
 *      Text record keys follow ENS conventions:
 *        - "description"       — agent role description
 *        - "url"               — portfolio / docs URL
 *        - "acn.reputation"    — reputation score (0-100)
 *        - "acn.role"          — agent role
 *        - "acn.skills"        — comma-separated skills
 *        - "acn.tasksCompleted" — total completed tasks
 *        - "acn.tasksFailed"   — total failed tasks
 */
contract ACNRegistry {
    // ── State ──

    address public owner;
    string public rootDomain; // "acn.eth"

    struct Subname {
        address owner;       // agent wallet address
        bool    exists;
        uint64  registeredAt;
    }

    /// @dev label hash → Subname record
    mapping(bytes32 => Subname) public subnames;

    /// @dev node (namehash) → key → value  (ENS text-record pattern)
    mapping(bytes32 => mapping(string => string)) private _texts;

    /// @dev label hash → full label string (for reverse lookup)
    mapping(bytes32 => string) public labelOf;

    /// @dev Total registered subnames
    uint256 public totalRegistered;

    // ── Events (match ENS resolver events for tooling compatibility) ──

    event SubnameRegistered(
        bytes32 indexed node,
        string  label,
        address indexed owner
    );

    event TextChanged(
        bytes32 indexed node,
        string  indexed indexedKey,
        string  key,
        string  value
    );

    event OwnershipTransferred(
        bytes32 indexed node,
        address indexed oldOwner,
        address indexed newOwner
    );

    // ── Modifiers ──

    modifier onlyOwner() {
        require(msg.sender == owner, "ACNRegistry: not owner");
        _;
    }

    modifier onlySubnameOwnerOrAdmin(bytes32 node) {
        require(
            msg.sender == owner || msg.sender == subnames[node].owner,
            "ACNRegistry: not authorised"
        );
        _;
    }

    // ── Constructor ──

    constructor(string memory _rootDomain) {
        owner = msg.sender;
        rootDomain = _rootDomain;
    }

    // ── Namehash helpers (mirrors ENS namehash algorithm) ──

    /**
     * @dev Compute the label hash for a subname label.
     *      Equivalent to keccak256(abi.encodePacked(label)).
     */
    function labelHash(string memory label) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(label));
    }

    /**
     * @dev Compute the node for a subname under our root.
     *      Follows ENS namehash: namehash("label.acn.eth") =
     *        keccak256(abi.encodePacked(namehash("acn.eth"), labelhash("label")))
     *      We use a simplified version since we own the root.
     */
    function namehash(string memory label) public pure returns (bytes32) {
        bytes32 rootNode = keccak256(abi.encodePacked(
            keccak256(abi.encodePacked(bytes32(0), keccak256("eth"))),
            keccak256("acn")
        ));
        return keccak256(abi.encodePacked(rootNode, keccak256(abi.encodePacked(label))));
    }

    // ══════════════════════════════════════════════════════
    //  Subname Registration
    // ══════════════════════════════════════════════════════

    /**
     * @dev Register a new subname under the root domain.
     *      Only the registry owner (ACN backend) can register.
     *
     *      Following the ENS subname registrar pattern:
     *        - Set owner to agent address
     *        - Pre-populate resolver text records
     *
     * @param label   The subname label (e.g. "summariser")
     * @param agent   The agent's wallet address
     * @return node   The namehash of the new subname
     */
    function registerSubname(
        string calldata label,
        address agent
    ) external onlyOwner returns (bytes32 node) {
        node = namehash(label);
        require(!subnames[node].exists, "ACNRegistry: label taken");
        require(agent != address(0), "ACNRegistry: zero address");

        subnames[node] = Subname({
            owner: agent,
            exists: true,
            registeredAt: uint64(block.timestamp)
        });

        labelOf[node] = label;
        totalRegistered++;

        emit SubnameRegistered(node, label, agent);
    }

    // ══════════════════════════════════════════════════════
    //  Text Records (ENSIP-5 compatible interface)
    // ══════════════════════════════════════════════════════

    /**
     * @dev Set a text record for a subname.
     *      Callable by the registry owner (backend) or the subname owner (agent).
     *
     *      ENS resolver interface:
     *        function setText(bytes32 node, string key, string value)
     *
     * @param node  The namehash of the subname
     * @param key   Record key (e.g. "acn.reputation", "description")
     * @param value Record value
     */
    function setText(
        bytes32 node,
        string calldata key,
        string calldata value
    ) external onlySubnameOwnerOrAdmin(node) {
        require(subnames[node].exists, "ACNRegistry: subname not found");
        _texts[node][key] = value;
        emit TextChanged(node, key, key, value);
    }

    /**
     * @dev Batch-set multiple text records in one transaction.
     *      Gas-efficient for setting reputation + role + skills together.
     */
    function setTexts(
        bytes32 node,
        string[] calldata keys,
        string[] calldata values
    ) external onlySubnameOwnerOrAdmin(node) {
        require(subnames[node].exists, "ACNRegistry: subname not found");
        require(keys.length == values.length, "ACNRegistry: length mismatch");

        for (uint256 i = 0; i < keys.length; i++) {
            _texts[node][keys[i]] = values[i];
            emit TextChanged(node, keys[i], keys[i], values[i]);
        }
    }

    /**
     * @dev Read a text record for a subname.
     *      ENS resolver interface: function text(bytes32 node, string key)
     *
     * @param node The namehash of the subname
     * @param key  Record key
     * @return     Record value (empty string if not set)
     */
    function text(
        bytes32 node,
        string calldata key
    ) external view returns (string memory) {
        return _texts[node][key];
    }

    // ══════════════════════════════════════════════════════
    //  View helpers
    // ══════════════════════════════════════════════════════

    /**
     * @dev Check if a subname is registered.
     */
    function isRegistered(string calldata label) external view returns (bool) {
        return subnames[namehash(label)].exists;
    }

    /**
     * @dev Get the owner of a subname.
     */
    function ownerOf(string calldata label) external view returns (address) {
        bytes32 node = namehash(label);
        require(subnames[node].exists, "ACNRegistry: not found");
        return subnames[node].owner;
    }

    /**
     * @dev Get full subname (label.rootDomain).
     */
    function fullName(bytes32 node) external view returns (string memory) {
        require(subnames[node].exists, "ACNRegistry: not found");
        return string(abi.encodePacked(labelOf[node], ".", rootDomain));
    }

    /**
     * @dev Transfer contract ownership.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ACNRegistry: zero address");
        owner = newOwner;
    }

    /**
     * @dev ERC-165 interface support (for ENS resolver compatibility).
     *      0x59d1d43c = setText(bytes32,string,string)
     *      0x01ffc9a7 = supportsInterface(bytes4)
     */
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x59d1d43c // ITextResolver
            || interfaceId == 0x01ffc9a7; // ERC-165
    }
}
