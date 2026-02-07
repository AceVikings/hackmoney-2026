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
  workResults?: {
    agentId: string;
    result: any;
    submittedAt: string;
  }[];
}

export interface Activity {
  id: string;
  agentId: string;
  taskId: string;
  action: string;
  timestamp: string;
}

// In-memory stores
export const agents: Map<string, Agent> = new Map();
export const tasks: Map<string, Task> = new Map();
export const commitments: Map<string, Commitment> = new Map();
export const activities: Activity[] = [];
