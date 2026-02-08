import dotenv from 'dotenv';
import { v4 as uuid } from 'uuid';

dotenv.config();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001/api';

export class ACNAgent {
  constructor(
    public id: string,
    public ensName: string,
    public role: string,
    private privateKey: string // In production, use Circle WaaS / KMS
  ) {}

  async register() {
    try {
      const res = await fetch(`${BACKEND_URL}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ensName: this.ensName,
          walletAddress: this.getPublicAddress(),
          role: this.role,
          skills: ['autonomous', 'agentic'],
          maxLiability: 1000,
        }),
      });
      const data = await res.json();
      console.log(`[${this.ensName}] Registered with ID: ${data.id}`);
      this.id = data.id;
    } catch (err) {
      console.error(`[${this.ensName}] Registration failed`, err);
    }
  }

  getPublicAddress() {
    // Mock address generation
    return `0x${this.ensName.length}${this.id.replace(/-/g, '').slice(0, 38)}`;
  }

  async submitWork(taskId: string, result: any) {
    console.log(`[${this.ensName}] Submitting work for task ${taskId}...`);
    try {
      await fetch(`${BACKEND_URL}/tasks/${taskId}/work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: this.id,
          result: result,
        }),
      });
      console.log(`[${this.ensName}] Work submitted successfully.`);
    } catch (err) {
      console.error(`[${this.ensName}] Failed to submit work`, err);
    }
  }

  async run() {
    console.log(`[${this.ensName}] ${this.role} is running...`);
    // Listen for events, poll, etc.
  }
}
