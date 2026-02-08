/**
 * On-chain Escrow Service — Arc Testnet
 *
 * Interacts with the ACNEscrow smart contract deployed on Arc testnet.
 * All deposits, releases, and refunds are real on-chain transactions
 * with verifiable tx hashes on https://testnet.arcscan.app
 *
 * Arc testnet uses native USDC (18 decimals) as both gas token and value.
 */
import { ethers } from 'ethers';

// ── Constants ──

const ARC_TESTNET_RPC = 'https://rpc.testnet.arc.network';
const ARC_CHAIN_ID = 5042002;
const EXPLORER_BASE = 'https://testnet.arcscan.app';

// Deployed ACNEscrow contract address
const ESCROW_CONTRACT_ADDRESS = '0x1EA7813DBa034Fb65365f024A84F89Ee30025203';

// Minimal ABI for deposit / release / refund / getEscrow
const ESCROW_ABI = [
  'function deposit(bytes32 taskId) external payable',
  'function release(bytes32 taskId, address payable recipient) external',
  'function refund(bytes32 taskId) external',
  'function getEscrow(bytes32 taskId) external view returns (address depositor, uint256 amount, bool released, bool refunded)',
  'function owner() external view returns (address)',
  'event Deposited(bytes32 indexed taskId, address indexed depositor, uint256 amount)',
  'event Released(bytes32 indexed taskId, address indexed recipient, uint256 amount)',
  'event Refunded(bytes32 indexed taskId, address indexed depositor, uint256 amount)',
];

// ── Types ──

export interface EscrowTxResult {
  txHash: string;
  blockNumber: number;
  explorerUrl: string;
  gasUsed: string;
}

export interface EscrowState {
  depositor: string;
  amount: string;
  released: boolean;
  refunded: boolean;
}

// ── Service Class ──

export class EscrowService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;

  constructor(privateKey: string) {
    this.provider = new ethers.JsonRpcProvider(ARC_TESTNET_RPC, {
      chainId: ARC_CHAIN_ID,
      name: 'arc-testnet',
    });
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(ESCROW_CONTRACT_ADDRESS, ESCROW_ABI, this.wallet);

    console.log(`[Escrow] ✅ On-chain escrow service initialized`);
    console.log(`[Escrow]    Contract: ${ESCROW_CONTRACT_ADDRESS}`);
    console.log(`[Escrow]    Wallet:   ${this.wallet.address}`);
    console.log(`[Escrow]    Chain:    Arc Testnet (${ARC_CHAIN_ID})`);
    console.log(`[Escrow]    Explorer: ${EXPLORER_BASE}`);
  }

  /** Convert a MongoDB ObjectId (hex string) to a bytes32 for the contract */
  private taskIdToBytes32(taskId: string): string {
    // Pad the task ID (24-char hex) to 32 bytes
    const hex = taskId.replace(/^0x/, '').padStart(64, '0');
    return `0x${hex}`;
  }

  /** Get the wallet address (contract owner) */
  get address(): string {
    return this.wallet.address;
  }

  /** Get native USDC balance of the wallet */
  async getBalance(): Promise<string> {
    const bal = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(bal);
  }

  /**
   * Deposit native USDC into escrow for a task.
   * Sends a real on-chain transaction.
   *
   * @param taskId - MongoDB task ID (will be converted to bytes32)
   * @param amount - Amount in USDC (e.g. "0.5")
   * @returns Transaction result with real tx hash
   */
  async deposit(taskId: string, amount: string): Promise<EscrowTxResult> {
    const bytes32Id = this.taskIdToBytes32(taskId);
    const value = ethers.parseEther(amount);

    console.log(`[Escrow] 🔒 Depositing ${amount} USDC for task ${taskId}…`);
    console.log(`[Escrow]    bytes32: ${bytes32Id}`);
    console.log(`[Escrow]    value:   ${value.toString()} wei`);

    const tx = await this.contract.deposit(bytes32Id, { value });
    console.log(`[Escrow]    tx sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[Escrow] ✅ Deposit confirmed — block ${receipt.blockNumber}, gas ${receipt.gasUsed.toString()}`);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      explorerUrl: `${EXPLORER_BASE}/tx/${tx.hash}`,
      gasUsed: receipt.gasUsed.toString(),
    };
  }

  /**
   * Release escrowed funds to a recipient (settlement).
   * Only callable by the contract owner.
   *
   * @param taskId - MongoDB task ID
   * @param recipient - Address to receive the funds
   * @returns Transaction result with real tx hash
   */
  async release(taskId: string, recipient: string): Promise<EscrowTxResult> {
    const bytes32Id = this.taskIdToBytes32(taskId);

    console.log(`[Escrow] 💸 Releasing escrow for task ${taskId} → ${recipient}…`);

    const tx = await this.contract.release(bytes32Id, recipient);
    console.log(`[Escrow]    tx sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[Escrow] ✅ Release confirmed — block ${receipt.blockNumber}`);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      explorerUrl: `${EXPLORER_BASE}/tx/${tx.hash}`,
      gasUsed: receipt.gasUsed.toString(),
    };
  }

  /**
   * Refund escrowed funds back to the original depositor.
   * Only callable by the contract owner.
   *
   * @param taskId - MongoDB task ID
   * @returns Transaction result with real tx hash
   */
  async refund(taskId: string): Promise<EscrowTxResult> {
    const bytes32Id = this.taskIdToBytes32(taskId);

    console.log(`[Escrow] 🔄 Refunding escrow for task ${taskId}…`);

    const tx = await this.contract.refund(bytes32Id);
    console.log(`[Escrow]    tx sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[Escrow] ✅ Refund confirmed — block ${receipt.blockNumber}`);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      explorerUrl: `${EXPLORER_BASE}/tx/${tx.hash}`,
      gasUsed: receipt.gasUsed.toString(),
    };
  }

  /**
   * Read on-chain escrow state for a task.
   */
  async getEscrow(taskId: string): Promise<EscrowState> {
    const bytes32Id = this.taskIdToBytes32(taskId);
    const [depositor, amount, released, refunded] = await this.contract.getEscrow(bytes32Id);
    return {
      depositor,
      amount: ethers.formatEther(amount),
      released,
      refunded,
    };
  }

  /**
   * Get service status info.
   */
  getStatus() {
    return {
      contract: ESCROW_CONTRACT_ADDRESS,
      wallet: this.wallet.address,
      chain: ARC_CHAIN_ID,
      rpc: ARC_TESTNET_RPC,
      explorer: EXPLORER_BASE,
    };
  }
}

// ── Singleton ──

let instance: EscrowService | null = null;

export function getEscrowService(): EscrowService | null {
  return instance;
}

/**
 * Initialize the on-chain escrow service.
 * Requires ARC_PRIVATE_KEY in env (the key that deployed & owns the contract).
 */
export function initEscrowService(): EscrowService | null {
  const privateKey = process.env.ARC_PRIVATE_KEY;

  if (!privateKey) {
    console.warn('[Escrow] ⚠️  ARC_PRIVATE_KEY not set — on-chain escrow disabled');
    return null;
  }

  instance = new EscrowService(privateKey);
  return instance;
}
