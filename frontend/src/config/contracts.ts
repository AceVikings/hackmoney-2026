/**
 * ACNEscrow contract — deployed on Arc Testnet (chain 5042002)
 * Source: contracts/contracts/ACNEscrow.sol
 *
 * The deposit() function is permissionless — anyone can lock native USDC.
 * Only the contract owner (backend) can release/refund.
 */

export const ESCROW_CONTRACT_ADDRESS = '0x1EA7813DBa034Fb65365f024A84F89Ee30025203' as const;

export const ARC_CHAIN_ID = 5042002;

export const ESCROW_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'taskId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'getEscrow',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'taskId', type: 'bytes32' }],
    outputs: [
      { name: 'depositor', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'released', type: 'bool' },
      { name: 'refunded', type: 'bool' },
    ],
  },
] as const;

/**
 * Convert a MongoDB ObjectId (24-char hex) to bytes32 for the escrow contract.
 * Same logic as the backend's EscrowService.taskIdToBytes32.
 */
export function taskIdToBytes32(taskId: string): `0x${string}` {
  const hex = taskId.replace(/^0x/, '').padStart(64, '0');
  return `0x${hex}` as `0x${string}`;
}
