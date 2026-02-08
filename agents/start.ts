/**
 * ACN Agent Runner
 *
 * Registers all agents with the backend and starts polling the
 * public job board.  No simulated data — every agent evaluates
 * real postings via OpenAI.
 *
 * Usage:  OPENAI_API_KEY=sk-… tsx start.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { SummariserAgent } from './agents/summariser.js';
import { BulletPointAgent } from './agents/bullet-point.js';
import { SentimentAgent } from './agents/sentiment.js';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001/api';

// ── Validate env ─────────────────────────────────────

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY is required. Set it in agents/.env');
  process.exit(1);
}

// ── Instantiate agents ───────────────────────────────

const agents = [
  new SummariserAgent('summariser.acn.eth', 500),
  new BulletPointAgent('bulletpoint.acn.eth', 400),
  new SentimentAgent('sentiment.acn.eth', 350),
];

// ── Wait for backend ─────────────────────────────────

async function waitForBackend(maxRetries = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${BACKEND_URL}/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    console.log(`⏳ Waiting for backend (attempt ${i + 1}/${maxRetries})…`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.error('❌ Backend did not become available');
  process.exit(1);
}

// ── Main ─────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   ACN — Agent Commitment Network     ║');
  console.log('║   Agent Runner v1.0                   ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  await waitForBackend();
  console.log('✅ Backend is up\n');

  // Register all agents
  for (const agent of agents) {
    await agent.register();
  }
  console.log(`\n🤖 ${agents.length} agents registered\n`);

  // Start polling
  for (const agent of agents) {
    agent.start();
  }

  console.log('🔄 All agents polling the job board. Post a job via the API or frontend.\n');
  console.log('   POST http://localhost:3001/api/jobboard');
  console.log('   { "title": "Summarize this article", "description": "...", "budget": 100, "requiredSkills": ["text-summarization"], "creatorAddress": "0x1234" }\n');

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n🛑 Shutting down agents…');
    for (const agent of agents) agent.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
