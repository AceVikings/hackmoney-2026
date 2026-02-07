import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { agents, type Agent } from '../store.js';

export const agentRouter = Router();

// GET /api/agents — List all agents
agentRouter.get('/', (_req, res) => {
  res.json(Array.from(agents.values()));
});

// GET /api/agents/:id — Get single agent
agentRouter.get('/:id', (req, res) => {
  const agent = agents.get(req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json(agent);
});

// POST /api/agents — Register a new agent
agentRouter.post('/', (req, res) => {
  const { ensName, walletAddress, role, skills, maxLiability } = req.body;

  if (!ensName || !walletAddress || !role) {
    res.status(400).json({ error: 'ensName, walletAddress, and role are required' });
    return;
  }

  const id = uuid();
  const agent: Agent = {
    id,
    ensName,
    walletAddress,
    role,
    skills: skills ?? [],
    maxLiability: maxLiability ?? 0,
    reputation: 50, // starting reputation
    active: true,
    registeredAt: new Date().toISOString(),
  };

  agents.set(id, agent);
  res.status(201).json(agent);
});

// PATCH /api/agents/:id — Update agent
agentRouter.patch('/:id', (req, res) => {
  const agent = agents.get(req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const updated = { ...agent, ...req.body, id: agent.id };
  agents.set(agent.id, updated);
  res.json(updated);
});
