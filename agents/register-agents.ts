/**
 * Register all agents with the backend (which triggers ENS subname creation on Sepolia).
 * Does NOT start the polling loop — just registers and exits.
 *
 * Usage: npx tsx register-agents.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001/api';

interface AgentDef {
  ensName: string;
  role: string;
  skills: string[];
  maxLiability: number;
}

const AGENTS: AgentDef[] = [
  {
    ensName: 'summariser.acn.eth',
    role: 'Text Summariser',
    skills: ['text-summarization', 'content-condensation', 'tldr'],
    maxLiability: 500,
  },
  {
    ensName: 'bulletpoint.acn.eth',
    role: 'Bullet-Point Extractor',
    skills: ['text-summarization', 'bullet-points', 'key-extraction'],
    maxLiability: 400,
  },
  {
    ensName: 'sentiment.acn.eth',
    role: 'Sentiment Analyst',
    skills: ['sentiment-analysis', 'text-classification', 'opinion-mining'],
    maxLiability: 350,
  },
];

function deriveAddress(ensName: string): string {
  const privateKey = ethers.keccak256(ethers.toUtf8Bytes(ensName));
  const wallet = new ethers.Wallet(privateKey);
  return wallet.address;
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  ACN Agent Registration — ENS Subname on Sepolia  ');
  console.log('═══════════════════════════════════════════════════\n');

  // Check backend is up
  try {
    const health = await fetch(`${BACKEND_URL}/health`);
    if (!health.ok) throw new Error(`status ${health.status}`);
  } catch (err: any) {
    console.error(`❌ Backend not reachable at ${BACKEND_URL}: ${err.message}`);
    process.exit(1);
  }

  for (const agent of AGENTS) {
    const walletAddress = deriveAddress(agent.ensName);
    console.log(`\n📝 Registering ${agent.ensName}`);
    console.log(`   Wallet: ${walletAddress}`);
    console.log(`   Role:   ${agent.role}`);
    console.log(`   Skills: ${agent.skills.join(', ')}`);

    const res = await fetch(`${BACKEND_URL}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ensName: agent.ensName,
        walletAddress,
        role: agent.role,
        skills: agent.skills,
        maxLiability: agent.maxLiability,
      }),
    });

    if (!res.ok) {
      console.error(`   ❌ Registration failed: ${res.status} ${await res.text()}`);
      continue;
    }

    const data = await res.json();
    console.log(`   ✅ Registered — ID: ${data.id}`);
    console.log(`   ✅ ENS subname: ${data.subnameRegistered ? 'YES' : 'NO'}`);
    if (data.subnameTxHash && data.subnameTxHash !== '0x0') {
      console.log(`   🔗 Tx: https://sepolia.etherscan.io/tx/${data.subnameTxHash}`);
    }
    if (data.subnameNode) {
      console.log(`   🔑 Node: ${data.subnameNode}`);
    }
  }

  // Verify via ENS API
  console.log('\n\n── Verifying ENS records from PublicResolver ──\n');

  for (const agent of AGENTS) {
    const res = await fetch(`${BACKEND_URL}/ens/lookup/${agent.ensName}`);
    if (!res.ok) {
      console.log(`❌ ${agent.ensName}: not found in ENS`);
      continue;
    }
    const info = await res.json();
    console.log(`✅ ${info.fullName}`);
    console.log(`   addr:           ${info.addr}`);
    console.log(`   acn.role:       ${info.textRecords['acn.role']}`);
    console.log(`   acn.reputation: ${info.textRecords['acn.reputation']}`);
    console.log(`   acn.skills:     ${info.textRecords['acn.skills']}`);
    console.log('');
  }

  // Final status
  const status = await fetch(`${BACKEND_URL}/ens/status`).then(r => r.json());
  console.log(`\n📊 Total ENS subnames registered: ${status.totalRegistered}`);
  console.log('═══════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
