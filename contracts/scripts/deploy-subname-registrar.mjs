/**
 * Deploy ACNSubnameRegistrar to Ethereum Sepolia
 *
 * This deploys the subname registrar that interacts with the real ENS
 * NameWrapper on Sepolia to create subnames under acn.eth.
 *
 * Prerequisites:
 *   1. SEPOLIA_RPC_URL and SEPOLIA_PRIVATE_KEY set in contracts/.env
 *   2. The deployer wallet has Sepolia ETH for gas
 *   3. After deployment: the acn.eth owner must call
 *      NameWrapper.setApprovalForAll(registrar, true)
 *
 * Usage: node scripts/deploy-subname-registrar.mjs
 */
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// ── ENS Sepolia Constants ──
// From https://docs.ens.domains/learn/deployments
const SEPOLIA_NAME_WRAPPER    = '0x0635513f179D50A207757E05759CbD106d7dFcE8';
const SEPOLIA_PUBLIC_RESOLVER = '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5';
const ACN_ETH_NAMEHASH        = '0xb2423a11e21dd91238bf981679863591854b7bf82db6b1b9cfa3965a910cae8d';
const ACN_ETH_OWNER           = '0xf117731f927e655b6Ce05EE287da57e48c47622F';

const SEPOLIA_RPC     = process.env.SEPOLIA_RPC_URL;
const SEPOLIA_KEY     = process.env.SEPOLIA_PRIVATE_KEY;
const EXPLORER_BASE   = 'https://sepolia.etherscan.io';

async function main() {
  if (!SEPOLIA_RPC || !SEPOLIA_KEY) {
    console.error('❌ Set SEPOLIA_RPC_URL and SEPOLIA_PRIVATE_KEY in contracts/.env');
    console.error('   Get Sepolia ETH from https://sepoliafaucet.com/');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC, { chainId: 11155111, name: 'sepolia' });
  const wallet = new ethers.Wallet(SEPOLIA_KEY, provider);

  console.log(`Deployer:       ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance:        ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.error('❌ No Sepolia ETH — get some from https://sepoliafaucet.com/');
    process.exit(1);
  }

  // Load compiled artifact
  const artifactPath = path.join(
    __dirname, '..', 'artifacts', 'contracts',
    'ACNSubnameRegistrar.sol', 'ACNSubnameRegistrar.json'
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log(`\n── ENS Sepolia Configuration ──`);
  console.log(`NameWrapper:    ${SEPOLIA_NAME_WRAPPER}`);
  console.log(`PublicResolver: ${SEPOLIA_PUBLIC_RESOLVER}`);
  console.log(`acn.eth node:   ${ACN_ETH_NAMEHASH}`);
  console.log(`acn.eth owner:  ${ACN_ETH_OWNER}`);

  console.log(`\nDeploying ACNSubnameRegistrar...`);
  const contract = await factory.deploy(
    SEPOLIA_NAME_WRAPPER,
    SEPOLIA_PUBLIC_RESOLVER,
    ACN_ETH_NAMEHASH
  );

  const tx = contract.deploymentTransaction();
  console.log(`Tx hash:  ${tx.hash}`);
  console.log(`Explorer: ${EXPLORER_BASE}/tx/${tx.hash}`);

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`\n✅ ACNSubnameRegistrar deployed at: ${address}`);
  console.log(`Explorer: ${EXPLORER_BASE}/address/${address}`);

  // Verify state
  const contractOwner = await contract.owner();
  const contractParentNode = await contract.parentNode();
  console.log(`\nOwner:       ${contractOwner}`);
  console.log(`Parent node: ${contractParentNode}`);

  // ── IMPORTANT: Approval instructions ──
  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`  NEXT STEP: Approve the registrar on the NameWrapper`);
  console.log(`══════════════════════════════════════════════════════════`);
  console.log(`\nThe acn.eth owner (${ACN_ETH_OWNER}) must call:`);
  console.log(`  NameWrapper.setApprovalForAll(${address}, true)`);
  console.log(`\nNameWrapper address: ${SEPOLIA_NAME_WRAPPER}`);
  console.log(`\nYou can do this via:`);
  console.log(`  1. Run: node scripts/approve-registrar.mjs`);
  console.log(`     (if SEPOLIA_PRIVATE_KEY is the acn.eth owner key)`);
  console.log(`  2. Or go to Etherscan and call setApprovalForAll manually:`);
  console.log(`     ${EXPLORER_BASE}/address/${SEPOLIA_NAME_WRAPPER}#writeContract`);
  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`ACNSubnameRegistrar: ${address}`);
  console.log(`══════════════════════════════════════════════════════════`);
}

main().catch(console.error);
