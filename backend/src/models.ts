import mongoose, { Schema, type Document } from 'mongoose';

// ── Agent ────────────────────────────────────────────

export interface IAgent extends Document {
  ensName: string;
  walletAddress: string;
  role: string;
  skills: string[];
  maxLiability: number;
  reputation: number;
  active: boolean;
  registeredAt: Date;
  // ENS subname registration
  subnameRegistered: boolean;
  subnameNode: string | null;
  subnameTxHash: string | null;
  tasksCompleted: number;
  tasksFailed: number;
}

const AgentSchema = new Schema<IAgent>({
  ensName:        { type: String, required: true, unique: true },
  walletAddress:  { type: String, required: true },
  role:           { type: String, required: true },
  skills:         { type: [String], default: [] },
  maxLiability:   { type: Number, default: 0 },
  reputation:     { type: Number, default: 50 },
  active:         { type: Boolean, default: true },
  registeredAt:   { type: Date, default: Date.now },
  // ENS subname registration
  subnameRegistered: { type: Boolean, default: false },
  subnameNode:       { type: String, default: null },
  subnameTxHash:     { type: String, default: null },
  tasksCompleted:    { type: Number, default: 0 },
  tasksFailed:       { type: Number, default: 0 },
});

export const Agent = mongoose.model<IAgent>('Agent', AgentSchema);

// ── Task ─────────────────────────────────────────────

export interface ITask extends Document {
  title: string;
  description: string;
  budget: number;
  status: 'open' | 'in-progress' | 'review' | 'settlement' | 'completed' | 'reversed';
  creatorAddress: string;
  assignedAgents: string[];
  createdAt: Date;
  workResults: {
    agentId: string;
    result: any;
    submittedAt: Date;
  }[];
  // Escrow / settlement
  escrowAmount: number;
  escrowStatus: 'none' | 'pending_escrow' | 'held' | 'released' | 'refunded';
  escrowTxHash: string | null;
  settlementHash: string | null;
  settlementTxId: string | null;
  settledAt: Date | null;
  // Nitrolite off-chain settlement
  nitroliteSettlementId: string | null;
}

const TaskSchema = new Schema<ITask>({
  title:           { type: String, required: true },
  description:     { type: String, default: '' },
  budget:          { type: Number, required: true },
  status:          { type: String, enum: ['open', 'in-progress', 'review', 'settlement', 'completed', 'reversed'], default: 'open' },
  creatorAddress:  { type: String, required: true, index: true },
  assignedAgents:  { type: [String], default: [] },
  createdAt:       { type: Date, default: Date.now },
  workResults:     { type: [{
    agentId:     String,
    result:      Schema.Types.Mixed,
    submittedAt: { type: Date, default: Date.now },
  }], default: [] },
  // Escrow / settlement
  escrowAmount:    { type: Number, default: 0 },
  escrowStatus:    { type: String, enum: ['none', 'pending_escrow', 'held', 'released', 'refunded'], default: 'none' },
  escrowTxHash:    { type: String, default: null },
  settlementHash:  { type: String, default: null },
  settlementTxId:  { type: String, default: null },
  settledAt:       { type: Date, default: null },
  nitroliteSettlementId: { type: String, default: null },
});

export const Task = mongoose.model<ITask>('Task', TaskSchema);

// ── Activity ─────────────────────────────────────────

export interface IActivity extends Document {
  agentId: string;
  taskId: string;
  action: string;
  timestamp: Date;
}

const ActivitySchema = new Schema<IActivity>({
  agentId:   { type: String, required: true },
  taskId:    { type: String, required: true },
  action:    { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export const Activity = mongoose.model<IActivity>('Activity', ActivitySchema);

// ── Commitment ───────────────────────────────────────

export interface ICommitment extends Document {
  taskId: string;
  parentAgentId: string | null;
  childAgentId: string;
  amount: number;
  reversalDeadline: Date;
  status: 'pending' | 'active' | 'reversed' | 'finalized';
  channelId: string | null;
}

const CommitmentSchema = new Schema<ICommitment>({
  taskId:           { type: String, required: true },
  parentAgentId:    { type: String, default: null },
  childAgentId:     { type: String, required: true },
  amount:           { type: Number, required: true },
  reversalDeadline: { type: Date, required: true },
  status:           { type: String, enum: ['pending', 'active', 'reversed', 'finalized'], default: 'pending' },
  channelId:        { type: String, default: null },
});

export const Commitment = mongoose.model<ICommitment>('Commitment', CommitmentSchema);

// ── Job Posting ──────────────────────────────────────

export interface IJobPosting extends Document {
  taskId: string;
  creatorAddress: string;
  title: string;
  description: string;
  budget: number;
  requiredSkills: string[];
  postedAt: Date;
  status: 'open' | 'assigned' | 'closed';
}

const JobPostingSchema = new Schema<IJobPosting>({
  taskId:         { type: String, required: true, index: true },
  creatorAddress: { type: String, required: true, index: true },
  title:          { type: String, required: true },
  description:    { type: String, default: '' },
  budget:         { type: Number, required: true },
  requiredSkills: { type: [String], default: [] },
  postedAt:       { type: Date, default: Date.now },
  status:         { type: String, enum: ['open', 'assigned', 'closed'], default: 'open' },
});

export const JobPosting = mongoose.model<IJobPosting>('JobPosting', JobPostingSchema);

// ── Job Bid ──────────────────────────────────────────

export interface IJobBid extends Document {
  jobId: string;
  agentId: string;
  agentEnsName: string;
  message: string;
  relevanceScore: number;
  estimatedTime: string;
  proposedAmount: number;
  accepted: boolean;
  createdAt: Date;
}

const JobBidSchema = new Schema<IJobBid>({
  jobId:          { type: String, required: true, index: true },
  agentId:        { type: String, required: true },
  agentEnsName:   { type: String, default: 'unknown.acn.eth' },
  message:        { type: String, required: true },
  relevanceScore: { type: Number, default: 0 },
  estimatedTime:  { type: String, default: 'unknown' },
  proposedAmount: { type: Number, default: 0 },
  accepted:       { type: Boolean, default: false },
  createdAt:      { type: Date, default: Date.now },
});

export const JobBid = mongoose.model<IJobBid>('JobBid', JobBidSchema);

// ── Nitrolite Channel ────────────────────────────────

export interface INitroliteChannel extends Document {
  channelId: string;
  taskId: string;
  participants: string[];
  status: 'open' | 'active' | 'closed';
  version: number;
  allocations: { participant: string; token: string; amount: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const NitroliteChannelSchema = new Schema<INitroliteChannel>({
  channelId:    { type: String, required: true, unique: true },
  taskId:       { type: String, required: true, index: true },
  participants: { type: [String], required: true },
  status:       { type: String, enum: ['open', 'active', 'closed'], default: 'open' },
  version:      { type: Number, default: 0 },
  allocations:  { type: [{ participant: String, token: String, amount: String }], default: [] },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now },
});

export const NitroliteChannel = mongoose.model<INitroliteChannel>('NitroliteChannel', NitroliteChannelSchema);
