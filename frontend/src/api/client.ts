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
}

export function fetchAgents() {
  return request<Agent[]>('/agents');
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

export function fetchActivityFeed() {
  return request<Activity[]>('/tasks/activity/feed');
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
