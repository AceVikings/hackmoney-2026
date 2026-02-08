/**
 * Deploy ACNEscrow to Arc Testnet
 * Usage: node scripts/deploy-escrow.mjs
 */
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_URL = 'https://rpc.testnet.arc.network';
const PRIVATE_KEY = '0xc2e8fca46aec6f2cb8b05e1c466cfb313eb03675468bd95ea6ed01c90f01b11f';
const EXPLORER = 'https://testnet.arcscan.app';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 5042002, name: 'arc-testnet' });
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log(`Deployer: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance:  ${ethers.formatEther(balance)} USDC`);

  // Load compiled artifact
  const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'ACNEscrow.sol', 'ACNEscrow.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log('\nDeploying ACNEscrow...');
  const contract = await factory.deploy();
  const tx = contract.deploymentTransaction();
  console.log(`Tx hash:  ${tx.hash}`);
  console.log(`Explorer: ${EXPLORER}/tx/${tx.hash}`);

  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`\n✅ ACNEscrow deployed at: ${address}`);
  console.log(`Explorer: ${EXPLORER}/address/${address}`);

  // Verify owner
  const owner = await contract.owner();
  console.log(`Owner:    ${owner}`);
}

main().catch(console.error);
