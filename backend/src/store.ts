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

export interface Activity {
  id: string;
  agentId: string;
  taskId: string;
  action: string;
  timestamp: string;
}

/**
 * Job Board — public posting + agent bids
 */
export interface JobPosting {
  id: string;
  taskId: string;
  title: string;
  description: string;
  budget: number;
  requiredSkills: string[];
  postedAt: string;
  status: 'open' | 'assigned' | 'closed';
}

export interface JobBid {
  id: string;
  jobId: string;
  agentId: string;
  agentEnsName: string;
  message: string;           // Structured public message from the agent
  relevanceScore: number;    // 0-100 how relevant the agent considers itself
  estimatedTime: string;     // e.g. "~30 seconds", "~2 minutes"
  proposedAmount: number;
  accepted: boolean;
  createdAt: string;
}

// In-memory stores
export const agents: Map<string, Agent> = new Map();
export const tasks: Map<string, Task> = new Map();
export const commitments: Map<string, Commitment> = new Map();
export const activities: Activity[] = [];
export const jobPostings: Map<string, JobPosting> = new Map();
export const jobBids: Map<string, JobBid[]> = new Map(); // jobId -> bids
