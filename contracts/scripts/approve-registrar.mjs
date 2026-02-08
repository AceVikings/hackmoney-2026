/**
 * Approve ACNSubnameRegistrar on the ENS NameWrapper
 *
 * This script calls NameWrapper.setApprovalForAll(registrar, true)
 * from the acn.eth owner wallet.
 *
 * The SEPOLIA_PRIVATE_KEY in .env MUST be the key for the acn.eth owner:
 *   0x0fCe963885b15a12832813798980bDadc9744705
 *
 * Usage: node scripts/approve-registrar.mjs <REGISTRAR_ADDRESS>
 */
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// ── ENS Sepolia Constants ──
const SEPOLIA_NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';
const ACN_ETH_OWNER        = '0xf117731f927e655b6Ce05EE287da57e48c47622F';
const EXPLORER_BASE        = 'https://sepolia.etherscan.io';

const NAME_WRAPPER_ABI = [
  'function setApprovalForAll(address operator, bool approved) external',
  'function isApprovedForAll(address account, address operator) external view returns (bool)',
  'function ownerOf(uint256 id) external view returns (address)',
];

async function main() {
  const registrarAddress = process.argv[2];
  if (!registrarAddress) {
    console.error('Usage: node scripts/approve-registrar.mjs <REGISTRAR_ADDRESS>');
    process.exit(1);
  }

  const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL;
  const SEPOLIA_KEY = process.env.SEPOLIA_PRIVATE_KEY;

  if (!SEPOLIA_RPC || !SEPOLIA_KEY) {
    console.error('❌ Set SEPOLIA_RPC_URL and SEPOLIA_PRIVATE_KEY in contracts/.env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC, { chainId: 11155111, name: 'sepolia' });
  const wallet = new ethers.Wallet(SEPOLIA_KEY, provider);

  console.log(`Wallet: ${wallet.address}`);

  if (wallet.address.toLowerCase() !== ACN_ETH_OWNER.toLowerCase()) {
    console.warn(`\n⚠️  WARNING: This wallet (${wallet.address}) is NOT the acn.eth owner (${ACN_ETH_OWNER}).`);
    console.warn(`   The approval must come from the acn.eth owner.`);
    console.warn(`   If you control acn.eth from a different key, update SEPOLIA_PRIVATE_KEY.\n`);
  }

  const nameWrapper = new ethers.Contract(SEPOLIA_NAME_WRAPPER, NAME_WRAPPER_ABI, wallet);

  // Check if already approved
  const alreadyApproved = await nameWrapper.isApprovedForAll(wallet.address, registrarAddress);
  if (alreadyApproved) {
    console.log(`✅ Registrar ${registrarAddress} is already approved!`);
    return;
  }

  console.log(`\nApproving registrar ${registrarAddress} on NameWrapper...`);
  const tx = await nameWrapper.setApprovalForAll(registrarAddress, true);
  console.log(`Tx hash:  ${tx.hash}`);
  console.log(`Explorer: ${EXPLORER_BASE}/tx/${tx.hash}`);

  await tx.wait();
  console.log(`\n✅ Approval confirmed!`);

  // Verify
  const isApproved = await nameWrapper.isApprovedForAll(wallet.address, registrarAddress);
  console.log(`Verified: isApprovedForAll = ${isApproved}`);
}

main().catch(console.error);
