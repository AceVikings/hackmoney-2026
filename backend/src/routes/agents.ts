import { Router } from 'express';
import { Agent } from '../models.js';

export const agentRouter = Router();

// GET /api/agents — List all agents
agentRouter.get('/', async (_req, res) => {
  const agents = await Agent.find().sort({ registeredAt: -1 }).lean();
  res.json(agents.map((a) => ({ ...a, id: a._id })));
});

// GET /api/agents/:id — Get single agent
agentRouter.get('/:id', async (req, res) => {
  const agent = await Agent.findById(req.params.id).lean();
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json({ ...agent, id: agent._id });
});

// POST /api/agents — Register a new agent
agentRouter.post('/', async (req, res) => {
  const { ensName, walletAddress, role, skills, maxLiability } = req.body;

  if (!ensName || !walletAddress || !role) {
    res.status(400).json({ error: 'ensName, walletAddress, and role are required' });
    return;
  }

  const agent = await Agent.create({
    ensName,
    walletAddress,
    role,
    skills: skills ?? [],
    maxLiability: maxLiability ?? 0,
    reputation: 50,
    active: true,
  });

  const obj = agent.toObject();
  res.status(201).json({ ...obj, id: obj._id });
});

// PATCH /api/agents/:id — Update agent
agentRouter.patch('/:id', async (req, res) => {
  const agent = await Agent.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true },
  ).lean();

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json({ ...agent, id: agent._id });
});
