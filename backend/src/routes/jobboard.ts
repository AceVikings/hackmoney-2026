import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import {
  jobPostings,
  jobBids,
  tasks,
  activities,
  type JobPosting,
  type JobBid,
} from '../store.js';

export const jobBoardRouter = Router();

// ── GET /api/jobboard — List all job postings ──
jobBoardRouter.get('/', (_req, res) => {
  const postings = Array.from(jobPostings.values()).sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
  );

  const result = postings.map((posting) => ({
    ...posting,
    bids: jobBids.get(posting.id) ?? [],
  }));

  res.json(result);
});

// ── GET /api/jobboard/:id — Single posting with bids ──
jobBoardRouter.get('/:id', (req, res) => {
  const posting = jobPostings.get(req.params.id);
  if (!posting) {
    res.status(404).json({ error: 'Job posting not found' });
    return;
  }
  res.json({ ...posting, bids: jobBids.get(posting.id) ?? [] });
});

// ── POST /api/jobboard — Create a job posting (also creates a task) ──
jobBoardRouter.post('/', (req, res) => {
  const { title, description, budget, requiredSkills, creatorAddress } = req.body;

  if (!title || !budget || !creatorAddress) {
    res.status(400).json({ error: 'title, budget, and creatorAddress are required' });
    return;
  }

  // Create the underlying task
  const taskId = uuid();
  tasks.set(taskId, {
    id: taskId,
    title,
    description: description ?? '',
    budget,
    status: 'open',
    creatorAddress,
    assignedAgents: [],
    createdAt: new Date().toISOString(),
  });

  // Create the job posting
  const jobId = uuid();
  const posting: JobPosting = {
    id: jobId,
    taskId,
    title,
    description: description ?? '',
    budget,
    requiredSkills: requiredSkills ?? [],
    postedAt: new Date().toISOString(),
    status: 'open',
  };
  jobPostings.set(jobId, posting);
  jobBids.set(jobId, []);

  activities.push({
    id: uuid(),
    agentId: 'SYSTEM',
    taskId,
    action: 'JOB_POSTED',
    timestamp: new Date().toISOString(),
  });

  res.status(201).json({ ...posting, bids: [] });
});

// ── POST /api/jobboard/:id/bid — Agent submits a bid ──
jobBoardRouter.post('/:id/bid', (req, res) => {
  const posting = jobPostings.get(req.params.id);
  if (!posting) {
    res.status(404).json({ error: 'Job posting not found' });
    return;
  }

  const { agentId, agentEnsName, message, relevanceScore, estimatedTime, proposedAmount } =
    req.body;

  if (!agentId || !message) {
    res.status(400).json({ error: 'agentId and message are required' });
    return;
  }

  const bid: JobBid = {
    id: uuid(),
    jobId: posting.id,
    agentId,
    agentEnsName: agentEnsName ?? 'unknown.acn.eth',
    message,
    relevanceScore: relevanceScore ?? 0,
    estimatedTime: estimatedTime ?? 'unknown',
    proposedAmount: proposedAmount ?? posting.budget,
    accepted: false,
    createdAt: new Date().toISOString(),
  };

  const bids = jobBids.get(posting.id) ?? [];
  bids.push(bid);
  jobBids.set(posting.id, bids);

  activities.push({
    id: uuid(),
    agentId,
    taskId: posting.taskId,
    action: 'BID_SUBMITTED',
    timestamp: new Date().toISOString(),
  });

  res.status(201).json(bid);
});

// ── POST /api/jobboard/:id/accept — Accept a bid and assign the agent ──
jobBoardRouter.post('/:id/accept', (req, res) => {
  const posting = jobPostings.get(req.params.id);
  if (!posting) {
    res.status(404).json({ error: 'Job posting not found' });
    return;
  }

  const { bidId } = req.body;
  if (!bidId) {
    res.status(400).json({ error: 'bidId is required' });
    return;
  }

  const bids = jobBids.get(posting.id) ?? [];
  const bid = bids.find((b) => b.id === bidId);
  if (!bid) {
    res.status(404).json({ error: 'Bid not found' });
    return;
  }

  bid.accepted = true;
  posting.status = 'assigned';

  // Update the task
  const task = tasks.get(posting.taskId);
  if (task) {
    task.status = 'in-progress';
    task.assignedAgents.push(bid.agentId);
  }

  activities.push({
    id: uuid(),
    agentId: bid.agentId,
    taskId: posting.taskId,
    action: 'BID_ACCEPTED',
    timestamp: new Date().toISOString(),
  });

  res.json({ posting, bid, task });
});
