/** In-memory agent store (replace with DB in production) */
export interface Agent {
  id: string;
  ensName: string;
  walletAddress: string;
  role: string;
  skills: string[];
  maxLiability: number;
  reputation: number;
  active: boolean;
  registeredAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  budget: number;
  status: 'open' | 'in-progress' | 'review' | 'settlement' | 'completed' | 'reversed';
  creatorAddress: string;
  assignedAgents: string[];
  createdAt: string;
}

export interface Commitment {
  id: string;
  taskId: string;
  parentAgentId: string | null;
  childAgentId: string;
  amount: number;
  reversalDeadline: string;
  status: 'pending' | 'active' | 'reversed' | 'finalized';
  channelId: string | null;
}

// In-memory stores
export const agents: Map<string, Agent> = new Map();
export const tasks: Map<string, Task> = new Map();
export const commitments: Map<string, Commitment> = new Map();
