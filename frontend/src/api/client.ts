const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Agent endpoints ──────────────────────────────────

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
  // ENS subname registration
  subnameRegistered?: boolean;
  subnameNode?: string | null;
  subnameTxHash?: string | null;
  tasksCompleted?: number;
  tasksFailed?: number;
}

export function fetchAgents() {
  return request<Agent[]>('/agents');
}

// ── ENS endpoints ────────────────────────────────────

export interface ENSSubnameInfo {
  label: string;
  fullName: string;
  owner: string;
  node: string;
  textRecords: Record<string, string>;
}

export interface ENSStatus {
  contract: string;
  wallet: string;
  chain: number;
  rpc: string;
  explorer: string;
  totalRegistered: number;
}

export function fetchENSStatus() {
  return request<ENSStatus>('/ens/status');
}

export function fetchENSLookup(ensName: string) {
  return request<ENSSubnameInfo>(`/ens/lookup/${ensName}`);
}

export function fetchENSRecords(ensName: string) {
  return request<{ ensName: string; node: string; records: Record<string, string> }>(`/ens/records/${ensName}`);
}

// ── Task endpoints ───────────────────────────────────

export interface Task {
  id: string;
  title: string;
  description: string;
  budget: number;
  status: string;
  creatorAddress: string;
  assignedAgents: string[];
  createdAt: string;
  workResults?: {
    agentId: string;
    result: any;
    submittedAt: string;
  }[];
  hasResults?: boolean;
  // Escrow / settlement
  escrowAmount?: number;
  escrowStatus?: 'none' | 'pending_escrow' | 'held' | 'released' | 'refunded';
  escrowTxHash?: string | null;
  settlementHash?: string | null;
  settlementTxId?: string | null;
  settledAt?: string | null;
  // Nitrolite off-chain settlement
  nitroliteSettlementId?: string | null;
}

export interface Activity {
  id: string;
  agentId: string;
  taskId: string;
  action: string;
  timestamp: string;
}

export function fetchTasks(address?: string) {
  const query = address ? `?address=${address}` : '';
  return request<Task[]>(`/tasks${query}`);
}

export function fetchActivityFeed(address?: string) {
  const query = address ? `?address=${address}` : '';
  return request<Activity[]>(`/tasks/activity/feed${query}`);
}

export function createTask(data: {
  title: string;
  description?: string;
  budget: number;
  creatorAddress: string;
}) {
  return request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateTaskStatus(id: string, status: string) {
  return request<Task>(`/tasks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// ── Wallet endpoints ─────────────────────────────────

export interface WalletInfo {
  agentId: string;
  walletId: string;
  address: string;
  blockchain: string;
  state: string;
}

export interface WalletBalance {
  agentId: string;
  balance: string;
  currency: string;
  blockchain: string;
}

export function provisionWallet(agentId: string) {
  return request<WalletInfo>('/wallets/provision', {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  });
}

export function fetchWalletBalance(agentId: string) {
  return request<WalletBalance>(`/wallets/${agentId}/balance`);
}

// ── Health ────────────────────────────────────────────

export function checkHealth() {
  return request<{ status: string; timestamp: string }>('/health');
}

// ── Job Board endpoints ──────────────────────────────

export interface JobBid {
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

export interface JobPostingWithBids {
  id: string;
  taskId: string;
  title: string;
  description: string;
  budget: number;
  requiredSkills: string[];
  postedAt: string;
  status: 'open' | 'assigned' | 'closed';
  creatorAddress: string;
  escrowStatus?: 'none' | 'pending_escrow' | 'held' | 'released' | 'refunded';
  escrowAmount?: number;
  escrowTxHash?: string | null;
  settlementHash?: string | null;
  bids: JobBid[];
}

export function fetchJobBoard() {
  return request<JobPostingWithBids[]>('/jobboard');
}

export function fetchJobPosting(id: string) {
  return request<JobPostingWithBids>(`/jobboard/${id}`);
}

export function createJobPosting(data: {
  title: string;
  description?: string;
  budget: number;
  requiredSkills?: string[];
  creatorAddress: string;
}) {
  return request<JobPostingWithBids>('/jobboard', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function confirmEscrow(jobId: string, txHash: string, depositorAddress: string) {
  return request<JobPostingWithBids>(`/jobboard/${jobId}/confirm-escrow`, {
    method: 'POST',
    body: JSON.stringify({ txHash, depositorAddress }),
  });
}

export function acceptBid(jobId: string, bidId: string, callerAddress: string) {
  return request<{ posting: JobPostingWithBids; bid: JobBid }>(`/jobboard/${jobId}/accept`, {
    method: 'POST',
    body: JSON.stringify({ bidId, callerAddress }),
  });
}

// ── Nitrolite endpoints ──────────────────────────────

export interface NitroliteStatus {
  enabled: boolean;
  connected: boolean;
  authenticated: boolean;
  address?: string;
  sessionKeyAddress?: string;
  clearNodeUrl?: string;
  message?: string;
}

export function fetchNitroliteStatus() {
  return request<NitroliteStatus>('/nitrolite/status');
}

export function fetchNitroliteBalances() {
  return request<any>('/nitrolite/balances');
}

// ── Escrow summary ───────────────────────────────────

export interface EscrowSummary {
  held: number;
  released: number;
  refunded: number;
  pending: number;
  total: number;
  count: number;
  tasks: { id: string; title: string; amount: number; status: string; txHash: string | null }[];
}

export function fetchEscrowSummary(address: string) {
  return request<EscrowSummary>(`/tasks/escrow-summary?address=${address}`);
}

export function requestRefund(taskId: string, callerAddress: string) {
  return request<Task>(`/tasks/${taskId}/refund`, {
    method: 'POST',
    body: JSON.stringify({ callerAddress }),
  });
}
