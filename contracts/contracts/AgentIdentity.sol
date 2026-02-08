// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentIdentity
 * @dev Implementation of EIP-8004 Identity Registry. 
 * Agents are represented as NFTs. The NFT ID is the Agent ID.
 */
contract AgentIdentity is ERC721Enumerable, Ownable {
    uint256 private _nextTokenId;

    struct AgentMetadata {
        string ensName;
        string portfolioURI; // IPFS hash to detailed manifest
        bool isActive;
    }

    mapping(uint256 => AgentMetadata) public agentMetadata;
    mapping(address => uint256) public addressToAgentId;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string ensName);

    constructor() ERC721("ACN Agent Identity", "ACNA") Ownable(msg.sender) {}

    function registerAgent(string calldata ensName, string calldata portfolioURI) external returns (uint256) {
        require(addressToAgentId[msg.sender] == 0, "Address already registered");
        
        uint256 tokenId = ++_nextTokenId;
        _safeMint(msg.sender, tokenId);
        
        agentMetadata[tokenId] = AgentMetadata({
            ensName: ensName,
            portfolioURI: portfolioURI,
            isActive: true
        });
        
        addressToAgentId[msg.sender] = tokenId;
        
        emit AgentRegistered(tokenId, msg.sender, ensName);
        return tokenId;
    }

    function updateMetadata(string calldata portfolioURI, bool isActive) external {
        uint256 tokenId = addressToAgentId[msg.sender];
        require(tokenId != 0, "Not registered");
        
        agentMetadata[tokenId].portfolioURI = portfolioURI;
        agentMetadata[tokenId].isActive = isActive;
    }

    function getAgentId(address agent) external view returns (uint256) {
        return addressToAgentId[agent];
    }
}
