import { Router } from 'express';
import { Agent } from '../models.js';
import { getENSRegistryService, ACN_RECORD_KEYS } from '../services/ens-registry.js';

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

// POST /api/agents — Register (or re-register) an agent
// Idempotent: upserts by ensName so restarts don't create duplicates
// Also registers an on-chain ENS subname via ACNRegistry
agentRouter.post('/', async (req, res) => {
  const { ensName, walletAddress, role, skills, maxLiability } = req.body;

  if (!ensName || !walletAddress || !role) {
    res.status(400).json({ error: 'ensName, walletAddress, and role are required' });
    return;
  }

  const agent = await Agent.findOneAndUpdate(
    { ensName },
    {
      $set: {
        walletAddress,
        role,
        skills: skills ?? [],
        maxLiability: maxLiability ?? 0,
        active: true,
      },
      $setOnInsert: {
        reputation: 50,
        registeredAt: new Date(),
        subnameRegistered: false,
        subnameNode: null,
        subnameTxHash: null,
        tasksCompleted: 0,
        tasksFailed: 0,
      },
    },
    { upsert: true, new: true, runValidators: true },
  ).lean();

  // ── Register ENS subname on-chain (idempotent — skips if already registered) ──
  const ens = getENSRegistryService();
  if (ens && !agent.subnameRegistered) {
    try {
      const result = await ens.registerSubname(ensName, walletAddress, {
        [ACN_RECORD_KEYS.REPUTATION]: '50',
        [ACN_RECORD_KEYS.ROLE]: role,
        [ACN_RECORD_KEYS.SKILLS]: (skills ?? []).join(','),
        [ACN_RECORD_KEYS.DESCRIPTION]: `${role} agent in the ACN network`,
        [ACN_RECORD_KEYS.TASKS_COMPLETED]: '0',
        [ACN_RECORD_KEYS.TASKS_FAILED]: '0',
      });

      // Update agent with subname info
      await Agent.findByIdAndUpdate(agent._id, {
        subnameRegistered: true,
        subnameNode: result.node,
        subnameTxHash: result.txHash !== '0x0' ? result.txHash : null,
      });

      // Merge into response
      (agent as any).subnameRegistered = true;
      (agent as any).subnameNode = result.node;
      (agent as any).subnameTxHash = result.txHash !== '0x0' ? result.txHash : null;

      console.log(`[Agents] ✅ ENS subname registered: ${ensName} → ${result.node}`);
    } catch (err: any) {
      console.error(`[Agents] ⚠️  ENS subname registration failed for ${ensName}:`, err.message);
      // Non-fatal: agent still registered in DB, subname can be retried
    }
  }

  res.status(201).json({ ...agent, id: agent._id });
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
