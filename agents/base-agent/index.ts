import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001/api';
const POLL_INTERVAL = parseInt(process.env.AGENT_POLL_INTERVAL_MS || '4000', 10);

// ── Types ────────────────────────────────────────────

export interface JobPosting {
  id: string;
  taskId: string;
  title: string;
  description: string;
  budget: number;
  requiredSkills: string[];
  postedAt: string;
  status: 'open' | 'assigned' | 'closed';
  bids: JobBidResponse[];
}

export interface JobBidResponse {
  id: string;
  jobId: string;
  agentId: string;
  agentEnsName: string;
  message: string;
  relevanceScore: number;
  estimatedTime: string;
  proposedAmount: number;
  accepted: boolean;
  createdAt: string;
}

export interface JobEvaluation {
  relevanceScore: number;
  message: string;
  estimatedTime: string;
  proposedAmount: number;
}

export interface TaskResult {
  success: boolean;
  output: any;
  summary: string;
}

// ── Abstract Base Agent ──────────────────────────────

export abstract class ACNAgent {
  public id = '';
  private bidJobIds = new Set<string>();
  private executedTaskIds = new Set<string>();
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    public ensName: string,
    public role: string,
    public maxLiability: number,
  ) {}

  /** Skills this agent supports (lowercase tags). */
  abstract getSkills(): string[];

  /** Evaluate a job posting. Return null if not relevant. */
  abstract evaluateJob(job: JobPosting): Promise<JobEvaluation | null>;

  /** Execute accepted work. */
  abstract executeTask(taskId: string, description: string): Promise<TaskResult>;

  // ── Lifecycle ────────────────────────────────────

  async register(): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ensName: this.ensName,
        walletAddress: this.deriveAddress(),
        role: this.role,
        skills: this.getSkills(),
        maxLiability: this.maxLiability,
      }),
    });
    const data = await res.json();
    this.id = data.id;
    console.log(`[${this.ensName}] ✅ Registered — ID ${this.id}`);
  }

  /** Start polling the job board. */
  start(): void {
    console.log(`[${this.ensName}] 🔄 Polling job board every ${POLL_INTERVAL}ms`);
    this.pollHandle = setInterval(() => this.poll(), POLL_INTERVAL);
  }

  stop(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  // ── Internals ────────────────────────────────────

  private async poll(): Promise<void> {
    try {
      const res = await fetch(`${BACKEND_URL}/jobboard`);
      const jobs: JobPosting[] = await res.json();

      for (const job of jobs) {
        // ── Check for accepted bids → auto-execute ──
        if (job.status === 'assigned' && !this.executedTaskIds.has(job.taskId)) {
          const myAcceptedBid = job.bids.find(
            (b) => b.agentId === this.id && b.accepted,
          );
          if (myAcceptedBid) {
            this.executedTaskIds.add(job.taskId);
            console.log(`[${this.ensName}] 🚀 Bid accepted! Executing task "${job.title}"…`);
            const result = await this.executeTask(job.taskId, job.description);
            await this.submitWork(job.taskId, result);
          }
        }

        // ── Bid on open jobs ──
        if (job.status !== 'open') continue;
        if (this.bidJobIds.has(job.id)) continue;

        const evaluation = await this.evaluateJob(job);
        if (!evaluation) {
          console.log(`[${this.ensName}] ⏭️  Skipped job "${job.title}" (not relevant)`);
          this.bidJobIds.add(job.id); // don't re-check
          continue;
        }

        await this.submitBid(job.id, evaluation);
        this.bidJobIds.add(job.id);
      }
    } catch {
      // Backend may not be up yet; silently retry
    }
  }

  private async submitBid(jobId: string, evaluation: JobEvaluation): Promise<void> {
    await fetch(`${BACKEND_URL}/jobboard/${jobId}/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: this.id,
        agentEnsName: this.ensName,
        message: evaluation.message,
        relevanceScore: evaluation.relevanceScore,
        estimatedTime: evaluation.estimatedTime,
        proposedAmount: evaluation.proposedAmount,
      }),
    });
    console.log(`[${this.ensName}] 📝 Bid submitted (relevance: ${evaluation.relevanceScore}%)`);
  }

  async submitWork(taskId: string, result: TaskResult): Promise<void> {
    await fetch(`${BACKEND_URL}/tasks/${taskId}/work`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: this.id,
        result: result.output,
      }),
    });
    console.log(`[${this.ensName}] ✅ Work submitted — ${result.summary}`);
  }

  /**
   * Derive a deterministic wallet address from the agent's ENS name.
   * Uses keccak256(ensName) as a private key seed to produce a real
   * Ethereum address that is consistent across restarts.
   */
  private deriveAddress(): string {
    const privateKey = ethers.keccak256(ethers.toUtf8Bytes(this.ensName));
    const wallet = new ethers.Wallet(privateKey);
    return wallet.address;
  }
}
