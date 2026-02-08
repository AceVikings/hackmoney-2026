/**
 * On-chain ENS Registry Service — Arc Testnet
 *
 * Interacts with the ACNRegistry smart contract to:
 *   1. Register subnames (e.g. "summariser.acn.eth") when agents join
 *   2. Set/read text records (reputation, role, skills) — ENSIP-5 pattern
 *
 * Contract: ACNRegistry deployed on Arc testnet
 * Pattern:  ENS subname registrar + built-in text resolver
 * Docs:     https://docs.ens.domains/wrapper/creating-subname-registrar
 */
import { ethers } from 'ethers';

// ── Constants ──

const ARC_TESTNET_RPC = 'https://rpc.testnet.arc.network';
const ARC_CHAIN_ID = 5042002;
const EXPLORER_BASE = 'https://testnet.arcscan.app';

// Deployed ACNRegistry contract address
const REGISTRY_CONTRACT_ADDRESS = '0x1bdc65986cF1A1721502d4e41E4bAEF0810689B6';

// ABI — mirrors the ACNRegistry contract interface
const REGISTRY_ABI = [
  // Registration
  'function registerSubname(string calldata label, address agent) external returns (bytes32 node)',
  'function isRegistered(string calldata label) external view returns (bool)',
  'function ownerOf(string calldata label) external view returns (address)',
  'function fullName(bytes32 node) external view returns (string)',
  'function totalRegistered() external view returns (uint256)',

  // Text records (ENSIP-5 resolver interface)
  'function setText(bytes32 node, string calldata key, string calldata value) external',
  'function setTexts(bytes32 node, string[] calldata keys, string[] calldata values) external',
  'function text(bytes32 node, string calldata key) external view returns (string)',

  // Helpers
  'function namehash(string calldata label) external pure returns (bytes32)',
  'function labelHash(string calldata label) external pure returns (bytes32)',
  'function rootDomain() external view returns (string)',
  'function owner() external view returns (address)',

  // Events
  'event SubnameRegistered(bytes32 indexed node, string label, address indexed owner)',
  'event TextChanged(bytes32 indexed node, string indexed indexedKey, string key, string value)',
];

// Standard ACN text record keys (following ENS custom record conventions)
export const ACN_RECORD_KEYS = {
  REPUTATION:       'acn.reputation',
  ROLE:             'acn.role',
  SKILLS:           'acn.skills',
  TASKS_COMPLETED:  'acn.tasksCompleted',
  TASKS_FAILED:     'acn.tasksFailed',
  DESCRIPTION:      'description',
  URL:              'url',
} as const;

// ── Types ──

export interface RegistryTxResult {
  txHash: string;
  blockNumber: number;
  explorerUrl: string;
  gasUsed: string;
}

export interface SubnameInfo {
  label: string;
  fullName: string;
  owner: string;
  node: string;
  textRecords: Record<string, string>;
}

// ── Service Class ──

export class ENSRegistryService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;

  constructor(privateKey: string) {
    this.provider = new ethers.JsonRpcProvider(ARC_TESTNET_RPC, {
      chainId: ARC_CHAIN_ID,
      name: 'arc-testnet',
    });
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(REGISTRY_CONTRACT_ADDRESS, REGISTRY_ABI, this.wallet);

    console.log(`[ENS] ✅ ENS registry service initialized`);
    console.log(`[ENS]    Contract: ${REGISTRY_CONTRACT_ADDRESS}`);
    console.log(`[ENS]    Wallet:   ${this.wallet.address}`);
    console.log(`[ENS]    Explorer: ${EXPLORER_BASE}/address/${REGISTRY_CONTRACT_ADDRESS}`);
  }

  /**
   * Extract label from an ENS name like "summariser.acn.eth" → "summariser"
   */
  private extractLabel(ensName: string): string {
    // "summariser.acn.eth" → "summariser"
    const parts = ensName.split('.');
    if (parts.length >= 3 && parts[parts.length - 2] === 'acn' && parts[parts.length - 1] === 'eth') {
      return parts.slice(0, -2).join('.');
    }
    // If it's just a plain label, return as-is
    return ensName;
  }

  /**
   * Register a subname on-chain.
   *
   * Follows the ENS subname registrar pattern:
   *   NameWrapper.setSubnodeOwner(parentNode, label, owner, fuses, expiry)
   * simplified for our self-contained registry.
   *
   * @param ensName - Full ENS name (e.g. "summariser.acn.eth") or label
   * @param agentAddress - The agent's wallet address
   * @param initialRecords - Optional text records to set immediately
   * @returns Transaction result + node hash
   */
  async registerSubname(
    ensName: string,
    agentAddress: string,
    initialRecords?: Record<string, string>,
  ): Promise<RegistryTxResult & { node: string }> {
    const label = this.extractLabel(ensName);

    // Check if already registered
    const alreadyRegistered = await this.contract.isRegistered(label);
    if (alreadyRegistered) {
      console.log(`[ENS] ℹ️  "${label}.acn.eth" already registered — skipping`);
      const node = await this.contract.namehash(label);
      return {
        txHash: '0x0',
        blockNumber: 0,
        explorerUrl: '',
        gasUsed: '0',
        node,
      };
    }

    console.log(`[ENS] 📝 Registering "${label}.acn.eth" → ${agentAddress}…`);

    const tx = await this.contract.registerSubname(label, agentAddress);
    console.log(`[ENS]    tx sent: ${tx.hash}`);

    const receipt = await tx.wait();
    const node = await this.contract.namehash(label);

    console.log(`[ENS] ✅ Registered! Node: ${node}`);
    console.log(`[ENS]    Explorer: ${EXPLORER_BASE}/tx/${tx.hash}`);

    // Set initial text records if provided
    if (initialRecords && Object.keys(initialRecords).length > 0) {
      await this.setTextRecords(node, initialRecords);
    }

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      explorerUrl: `${EXPLORER_BASE}/tx/${tx.hash}`,
      gasUsed: receipt.gasUsed.toString(),
      node,
    };
  }

  /**
   * Set a single text record on a subname's resolver.
   *
   * ENS resolver interface:
   *   function setText(bytes32 node, string key, string value)
   */
  async setTextRecord(
    node: string,
    key: string,
    value: string,
  ): Promise<RegistryTxResult> {
    console.log(`[ENS] 📝 setText("${key}", "${value}") for ${node.slice(0, 10)}…`);

    const tx = await this.contract.setText(node, key, value);
    const receipt = await tx.wait();

    console.log(`[ENS] ✅ Text record set — ${EXPLORER_BASE}/tx/${tx.hash}`);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      explorerUrl: `${EXPLORER_BASE}/tx/${tx.hash}`,
      gasUsed: receipt.gasUsed.toString(),
    };
  }

  /**
   * Batch-set multiple text records in one transaction.
   * Gas-efficient for setting reputation + role + skills together.
   */
  async setTextRecords(
    node: string,
    records: Record<string, string>,
  ): Promise<RegistryTxResult> {
    const keys = Object.keys(records);
    const values = Object.values(records);

    console.log(`[ENS] 📝 setTexts(${keys.length} records) for ${node.slice(0, 10)}…`);

    const tx = await this.contract.setTexts(node, keys, values);
    const receipt = await tx.wait();

    console.log(`[ENS] ✅ ${keys.length} text records set — ${EXPLORER_BASE}/tx/${tx.hash}`);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      explorerUrl: `${EXPLORER_BASE}/tx/${tx.hash}`,
      gasUsed: receipt.gasUsed.toString(),
    };
  }

  /**
   * Read a text record from a subname's resolver.
   *
   * ENS resolver interface:
   *   function text(bytes32 node, string key) → string
   */
  async getTextRecord(node: string, key: string): Promise<string> {
    return this.contract.text(node, key);
  }

  /**
   * Read multiple text records at once.
   */
  async getTextRecords(
    node: string,
    keys: string[],
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    // Execute reads in parallel
    const values = await Promise.all(keys.map((k) => this.contract.text(node, k)));
    keys.forEach((k, i) => {
      results[k] = values[i];
    });
    return results;
  }

  /**
   * Get the node hash for a label.
   */
  async getNode(ensName: string): Promise<string> {
    const label = this.extractLabel(ensName);
    return this.contract.namehash(label);
  }

  /**
   * Check if a subname is registered.
   */
  async isRegistered(ensName: string): Promise<boolean> {
    const label = this.extractLabel(ensName);
    return this.contract.isRegistered(label);
  }

  /**
   * Get full subname info including text records.
   */
  async getSubnameInfo(ensName: string): Promise<SubnameInfo | null> {
    const label = this.extractLabel(ensName);
    const registered = await this.contract.isRegistered(label);
    if (!registered) return null;

    const node = await this.contract.namehash(label);
    const owner = await this.contract.ownerOf(label);
    const fullName = await this.contract.fullName(node);

    // Fetch all standard ACN text records
    const textRecords = await this.getTextRecords(node, Object.values(ACN_RECORD_KEYS));

    return { label, fullName, owner, node, textRecords };
  }

  /**
   * Update reputation text record after task completion/failure.
   * Called by settlement logic.
   */
  async updateReputation(
    ensName: string,
    newReputation: number,
    tasksCompleted: number,
    tasksFailed: number,
  ): Promise<RegistryTxResult | null> {
    const label = this.extractLabel(ensName);
    const registered = await this.contract.isRegistered(label);
    if (!registered) {
      console.warn(`[ENS] ⚠️ Cannot update reputation — "${label}.acn.eth" not registered`);
      return null;
    }

    const node = await this.contract.namehash(label);

    return this.setTextRecords(node, {
      [ACN_RECORD_KEYS.REPUTATION]: newReputation.toString(),
      [ACN_RECORD_KEYS.TASKS_COMPLETED]: tasksCompleted.toString(),
      [ACN_RECORD_KEYS.TASKS_FAILED]: tasksFailed.toString(),
    });
  }

  /**
   * Get total number of registered subnames.
   */
  async getTotalRegistered(): Promise<number> {
    const n = await this.contract.totalRegistered();
    return Number(n);
  }

  /**
   * Get service status info.
   */
  getStatus() {
    return {
      contract: REGISTRY_CONTRACT_ADDRESS,
      wallet: this.wallet.address,
      chain: ARC_CHAIN_ID,
      rpc: ARC_TESTNET_RPC,
      explorer: EXPLORER_BASE,
    };
  }
}

// ── Singleton ──

let instance: ENSRegistryService | null = null;

export function getENSRegistryService(): ENSRegistryService | null {
  return instance;
}

/**
 * Initialize the ENS registry service.
 * Uses the same ARC_PRIVATE_KEY as the escrow (deployer owns the registry too).
 */
export function initENSRegistryService(): ENSRegistryService | null {
  const privateKey = process.env.ARC_PRIVATE_KEY;

  if (!privateKey) {
    console.warn('[ENS] ⚠️ ARC_PRIVATE_KEY not set — ENS registry disabled');
    return null;
  }

  instance = new ENSRegistryService(privateKey);
  return instance;
}
