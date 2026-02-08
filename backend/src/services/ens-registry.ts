/**
 * On-chain ENS Subname Service — Ethereum Sepolia
 *
 * Interacts with the ACNSubnameRegistrar deployed on Sepolia to:
 *   1. Register real ENS subnames (e.g. "summariser.acn.eth") via NameWrapper
 *   2. Set/read text records on the official ENS PublicResolver (ENSIP-5)
 *
 * Architecture:
 *   - ACNSubnameRegistrar calls NameWrapper.setSubnodeRecord() to create subnames
 *   - Registrar owns the subname in NameWrapper so it can set resolver records
 *   - Text records are stored on the ENS PublicResolver and are globally readable
 *   - Anyone can resolve "summariser.acn.eth" via standard ENS resolution
 *
 * Docs:
 *   https://docs.ens.domains/wrapper/creating-subname-registrar
 *   https://docs.ens.domains/web/records#text-records
 *   https://docs.ens.domains/resolvers/interacting
 */
import { ethers } from 'ethers';

// ── Sepolia Constants ──

const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const SEPOLIA_CHAIN_ID = 11155111;
const EXPLORER_BASE = 'https://sepolia.etherscan.io';

// Deployed ACNSubnameRegistrar on Sepolia
const REGISTRAR_ADDRESS = '0x849e65D6A7E6cE7E3f398a81e568b38345a3c00f';

// Official ENS PublicResolver on Sepolia
// https://docs.ens.domains/learn/deployments
const PUBLIC_RESOLVER_ADDRESS = '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5';

// ABIs
const REGISTRAR_ABI = [
  // Registration
  'function register(string calldata label, address agentWallet, string[] calldata keys, string[] calldata values) external returns (bytes32 node)',
  'function isRegistered(bytes32 node) external view returns (bool)',
  'function getAgent(bytes32 node) external view returns (address)',
  'function nodeToLabel(bytes32 node) external view returns (string)',
  'function totalRegistered() external view returns (uint256)',
  'function owner() external view returns (address)',
  'function parentNode() external view returns (bytes32)',

  // Text records (proxied to PublicResolver)
  'function setText(bytes32 node, string calldata key, string calldata value) external',
  'function setTexts(bytes32 node, string[] calldata keys, string[] calldata values) external',
  'function text(bytes32 node, string calldata key) external view returns (string)',

  // Events
  'event SubnameRegistered(bytes32 indexed node, string label, address indexed agentWallet)',
  'event TextRecordSet(bytes32 indexed node, string key, string value)',
];

const RESOLVER_ABI = [
  'function text(bytes32 node, string calldata key) view returns (string)',
  'function addr(bytes32 node) view returns (address)',
];

// Standard ACN text record keys (following ENS custom record conventions / ENSIP-5)
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
  addr: string;
  textRecords: Record<string, string>;
}

// ── Service Class ──

export class ENSRegistryService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private registrar: ethers.Contract;
  private resolver: ethers.Contract;

  constructor(privateKey: string) {
    this.provider = new ethers.JsonRpcProvider(SEPOLIA_RPC, {
      chainId: SEPOLIA_CHAIN_ID,
      name: 'sepolia',
    });
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.registrar = new ethers.Contract(REGISTRAR_ADDRESS, REGISTRAR_ABI, this.wallet);
    this.resolver = new ethers.Contract(PUBLIC_RESOLVER_ADDRESS, RESOLVER_ABI, this.provider);

    console.log(`[ENS] ✅ ENS subname service initialized (Sepolia)`);
    console.log(`[ENS]    Registrar:  ${REGISTRAR_ADDRESS}`);
    console.log(`[ENS]    Resolver:   ${PUBLIC_RESOLVER_ADDRESS}`);
    console.log(`[ENS]    Wallet:     ${this.wallet.address}`);
    console.log(`[ENS]    Chain:      Sepolia (${SEPOLIA_CHAIN_ID})`);
    console.log(`[ENS]    Explorer:   ${EXPLORER_BASE}/address/${REGISTRAR_ADDRESS}`);
  }

  /**
   * Extract label from an ENS name like "summariser.acn.eth" → "summariser"
   */
  private extractLabel(ensName: string): string {
    const parts = ensName.split('.');
    if (parts.length >= 3 && parts[parts.length - 2] === 'acn' && parts[parts.length - 1] === 'eth') {
      return parts.slice(0, -2).join('.');
    }
    return ensName;
  }

  /**
   * Compute the ENS namehash for label.acn.eth using ethers.namehash.
   */
  private computeNode(label: string): string {
    return ethers.namehash(`${label}.acn.eth`);
  }

  /**
   * Register a subname on-chain via NameWrapper.
   *
   * Calls ACNSubnameRegistrar.register() which:
   *   1. Calls NameWrapper.setSubnodeRecord(parentNode, label, registrar, resolver, 0, 0, max)
   *   2. Sets text records on the ENS PublicResolver
   *   3. Sets addr record to the agent's wallet
   *
   * @param ensName        Full ENS name (e.g. "summariser.acn.eth") or label
   * @param agentAddress   The agent's wallet address
   * @param initialRecords Optional text records to set immediately
   * @returns Transaction result + namehash node
   */
  async registerSubname(
    ensName: string,
    agentAddress: string,
    initialRecords?: Record<string, string>,
  ): Promise<RegistryTxResult & { node: string }> {
    const label = this.extractLabel(ensName);
    const node = this.computeNode(label);

    // Check if already registered
    const alreadyRegistered = await this.registrar.isRegistered(node);
    if (alreadyRegistered) {
      console.log(`[ENS] ℹ️  "${label}.acn.eth" already registered on Sepolia — skipping`);
      return {
        txHash: '0x0',
        blockNumber: 0,
        explorerUrl: '',
        gasUsed: '0',
        node,
      };
    }

    const keys = initialRecords ? Object.keys(initialRecords) : [];
    const values = initialRecords ? Object.values(initialRecords) : [];

    console.log(`[ENS] 📝 Registering "${label}.acn.eth" → ${agentAddress} on Sepolia…`);

    const tx = await this.registrar.register(label, agentAddress, keys, values);
    console.log(`[ENS]    tx sent: ${tx.hash}`);
    console.log(`[ENS]    Explorer: ${EXPLORER_BASE}/tx/${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[ENS] ✅ Registered! Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed}`);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      explorerUrl: `${EXPLORER_BASE}/tx/${tx.hash}`,
      gasUsed: receipt.gasUsed.toString(),
      node,
    };
  }

  /**
   * Set a single text record on the ENS PublicResolver via our registrar.
   */
  async setTextRecord(
    node: string,
    key: string,
    value: string,
  ): Promise<RegistryTxResult> {
    console.log(`[ENS] 📝 setText("${key}", "${value}") on Sepolia…`);

    const tx = await this.registrar.setText(node, key, value);
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
   * Batch-set multiple text records in one Sepolia transaction.
   */
  async setTextRecords(
    node: string,
    records: Record<string, string>,
  ): Promise<RegistryTxResult> {
    const keys = Object.keys(records);
    const values = Object.values(records);

    console.log(`[ENS] 📝 setTexts(${keys.length} records) on Sepolia…`);

    const tx = await this.registrar.setTexts(node, keys, values);
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
   * Read a text record from the ENS PublicResolver (no tx needed).
   */
  async getTextRecord(node: string, key: string): Promise<string> {
    return this.resolver.text(node, key);
  }

  /**
   * Read multiple text records at once (parallel calls to PublicResolver).
   */
  async getTextRecords(
    node: string,
    keys: string[],
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    const values = await Promise.all(keys.map((k) => this.resolver.text(node, k)));
    keys.forEach((k, i) => {
      results[k] = values[i];
    });
    return results;
  }

  /**
   * Get the namehash node for a label.
   */
  getNode(ensName: string): string {
    const label = this.extractLabel(ensName);
    return this.computeNode(label);
  }

  /**
   * Check if a subname is registered on-chain.
   */
  async isRegistered(ensName: string): Promise<boolean> {
    const label = this.extractLabel(ensName);
    const node = this.computeNode(label);
    return this.registrar.isRegistered(node);
  }

  /**
   * Get full subname info including text records from the ENS PublicResolver.
   */
  async getSubnameInfo(ensName: string): Promise<SubnameInfo | null> {
    const label = this.extractLabel(ensName);
    const node = this.computeNode(label);

    const registered = await this.registrar.isRegistered(node);
    if (!registered) return null;

    const agentAddr = await this.registrar.getAgent(node);
    const resolvedAddr = await this.resolver.addr(node).catch(() => ethers.ZeroAddress);

    // Fetch all standard ACN text records from PublicResolver
    const textRecords = await this.getTextRecords(node, Object.values(ACN_RECORD_KEYS));

    return {
      label,
      fullName: `${label}.acn.eth`,
      owner: agentAddr,
      node,
      addr: resolvedAddr,
      textRecords,
    };
  }

  /**
   * Update reputation text records on ENS after task completion/failure.
   */
  async updateReputation(
    ensName: string,
    newReputation: number,
    tasksCompleted: number,
    tasksFailed: number,
  ): Promise<RegistryTxResult | null> {
    const label = this.extractLabel(ensName);
    const node = this.computeNode(label);

    const registered = await this.registrar.isRegistered(node);
    if (!registered) {
      console.warn(`[ENS] ⚠️ Cannot update reputation — "${label}.acn.eth" not registered on Sepolia`);
      return null;
    }

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
    const n = await this.registrar.totalRegistered();
    return Number(n);
  }

  /**
   * Get service status info.
   */
  getStatus() {
    return {
      registrar: REGISTRAR_ADDRESS,
      resolver: PUBLIC_RESOLVER_ADDRESS,
      wallet: this.wallet.address,
      chain: 'sepolia',
      chainId: SEPOLIA_CHAIN_ID,
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
 * Initialize the ENS subname service.
 * Requires SEPOLIA_PRIVATE_KEY — the key for the acn.eth owner
 * who deployed and owns the ACNSubnameRegistrar.
 */
export function initENSRegistryService(): ENSRegistryService | null {
  const privateKey = process.env.SEPOLIA_PRIVATE_KEY;

  if (!privateKey) {
    console.warn('[ENS] ⚠️ SEPOLIA_PRIVATE_KEY not set — ENS subname service disabled');
    return null;
  }

  instance = new ENSRegistryService(privateKey);
  return instance;
}
