/**
 * Deploy ACNRegistry to Arc Testnet
 * Usage: node scripts/deploy-registry.mjs
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
  const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'ACNRegistry.sol', 'ACNRegistry.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  // Constructor arg: root domain string
  const ROOT_DOMAIN = 'acn.eth';

  console.log(`\nDeploying ACNRegistry with root domain "${ROOT_DOMAIN}"...`);
  const contract = await factory.deploy(ROOT_DOMAIN);
  const tx = contract.deploymentTransaction();
  console.log(`Tx hash:  ${tx.hash}`);
  console.log(`Explorer: ${EXPLORER}/tx/${tx.hash}`);

  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`\n✅ ACNRegistry deployed at: ${address}`);
  console.log(`Explorer: ${EXPLORER}/address/${address}`);

  // Verify owner + root domain
  const owner = await contract.owner();
  const rootDomain = await contract.rootDomain();
  console.log(`Owner:       ${owner}`);
  console.log(`Root domain: ${rootDomain}`);

  // ── Quick smoke test: register a test subname ──
  console.log('\n── Smoke test ──');

  const testLabel = 'test-agent';
  const testAddr = wallet.address; // use deployer as test owner

  console.log(`Registering "${testLabel}.${ROOT_DOMAIN}" → ${testAddr}...`);
  const regTx = await contract.registerSubname(testLabel, testAddr);
  console.log(`Tx hash:  ${regTx.hash}`);
  await regTx.wait();

  const node = await contract.namehash(testLabel);
  console.log(`Node:     ${node}`);

  const isReg = await contract.isRegistered(testLabel);
  console.log(`Registered: ${isReg}`);

  const ownerOfName = await contract.ownerOf(testLabel);
  console.log(`Owner:      ${ownerOfName}`);

  const fullNameStr = await contract.fullName(node);
  console.log(`Full name:  ${fullNameStr}`);

  // Set a text record
  console.log('\nSetting text records...');
  const setTx = await contract.setTexts(
    node,
    ['acn.reputation', 'acn.role', 'description'],
    ['50', 'test', 'Smoke test agent']
  );
  console.log(`Tx hash: ${setTx.hash}`);
  await setTx.wait();

  // Read text records
  const rep = await contract.text(node, 'acn.reputation');
  const role = await contract.text(node, 'acn.role');
  const desc = await contract.text(node, 'description');
  console.log(`reputation:  ${rep}`);
  console.log(`role:        ${role}`);
  console.log(`description: ${desc}`);

  console.log('\n✅ All smoke tests passed!');
  console.log(`\n══════════════════════════════════════`);
  console.log(`ACNRegistry: ${address}`);
  console.log(`══════════════════════════════════════`);
}

main().catch(console.error);
