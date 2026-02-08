import { Router } from 'express';
import { Task, Activity, Agent } from '../models.js';
import { getEscrowService } from '../services/escrow.js';
import { getENSRegistryService } from '../services/ens-registry.js';
import { getNitroliteService } from '../services/nitrolite.js';

export const taskRouter = Router();

// GET /api/tasks — List user's own tasks only (scoped to creatorAddress)
taskRouter.get('/', async (req, res) => {
  const requesterAddress = req.query.address as string;
  if (!requesterAddress) {
    res.json([]);
    return;
  }

  // Only return tasks created by this user
  const tasks = await Task.find({
    creatorAddress: { $regex: new RegExp(`^${requesterAddress}$`, 'i') },
  }).sort({ createdAt: -1 }).lean();

  res.json(tasks.map((task) => ({ ...task, id: task._id })));
});

// GET /api/tasks/escrow-summary — Aggregate escrow stats for a user
taskRouter.get('/escrow-summary', async (req, res) => {
  const addr = req.query.address as string;
  if (!addr) {
    res.json({ held: 0, released: 0, refunded: 0, pending: 0, total: 0, count: 0 });
    return;
  }

  const tasks = await Task.find({
    creatorAddress: { $regex: new RegExp(`^${addr}$`, 'i') },
    escrowAmount: { $gt: 0 },
  }).lean();

  const summary = {
    held: 0,
    released: 0,
    refunded: 0,
    pending: 0,
    total: 0,
    count: tasks.length,
    tasks: [] as { id: string; title: string; amount: number; status: string; txHash: string | null }[],
  };

  for (const t of tasks) {
    const amt = t.escrowAmount ?? 0;
    summary.total += amt;
    if (t.escrowStatus === 'held') summary.held += amt;
    else if (t.escrowStatus === 'released') summary.released += amt;
    else if (t.escrowStatus === 'refunded') summary.refunded += amt;
    else if (t.escrowStatus === 'pending_escrow') summary.pending += amt;
    summary.tasks.push({
      id: (t._id as any).toString(),
      title: t.title,
      amount: amt,
      status: t.escrowStatus ?? 'none',
      txHash: t.escrowTxHash ?? null,
    });
  }

  res.json(summary);
});

// GET /api/tasks/activity/feed — Activity feed scoped to user's tasks
taskRouter.get('/activity/feed', async (req, res) => {
  const requesterAddress = req.query.address as string;

  if (!requesterAddress) {
    // No address → return empty (was previously public, now user-scoped)
    res.json([]);
    return;
  }

  // Find the user's task IDs first
  const userTasks = await Task.find({
    creatorAddress: { $regex: new RegExp(`^${requesterAddress}$`, 'i') },
  }).select('_id').lean();
  const userTaskIds = userTasks.map((t) => t._id!.toString());

  const activities = await Activity.find({ taskId: { $in: userTaskIds } })
    .sort({ timestamp: -1 })
    .limit(30)
    .lean();
  res.json(activities.map((a) => ({ ...a, id: a._id })));
});

// GET /api/tasks/:id — Get single task
taskRouter.get('/:id', async (req, res) => {
  const task = await Task.findById(req.params.id).lean();
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const requesterAddress = req.query.address as string;
  const isRequester =
    requesterAddress &&
    task.creatorAddress.toLowerCase() === requesterAddress.toLowerCase();

  if (isRequester) {
    res.json({ ...task, id: task._id });
  } else {
    const { workResults, ...publicTask } = task;
    res.json({ ...publicTask, id: task._id });
  }
});

// PATCH /api/tasks/:id/status — Update task status
taskRouter.patch('/:id/status', async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const { status, agentId } = req.body;
  const validStatuses = ['open', 'in-progress', 'review', 'settlement', 'completed', 'reversed'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    return;
  }

  task.status = status;
  await task.save();

  await Activity.create({
    agentId: agentId ?? 'SYSTEM',
    taskId: task._id!.toString(),
    action: `STATUS_CHANGED_TO_${status.toUpperCase()}`,
  });

  res.json({ ...task.toObject(), id: task._id });
});

// POST /api/tasks — Create a standalone task
taskRouter.post('/', async (req, res) => {
  const { title, description, budget, creatorAddress } = req.body;
  if (!title || !budget || !creatorAddress) {
    res.status(400).json({ error: 'title, budget, and creatorAddress are required' });
    return;
  }

  const task = await Task.create({
    title,
    description: description ?? '',
    budget,
    status: 'open',
    creatorAddress,
    assignedAgents: [],
  });

  await Activity.create({
    agentId: 'SYSTEM',
    taskId: task._id!.toString(),
    action: 'TASK_CREATED',
  });

  res.status(201).json({ ...task.toObject(), id: task._id });
});

// POST /api/tasks/:id/work — Agent submits work results → auto-settle payment
taskRouter.post('/:id/work', async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const { agentId, result } = req.body;
  if (!agentId || result === undefined) {
    res.status(400).json({ error: 'agentId and result are required' });
    return;
  }

  task.workResults.push({ agentId, result, submittedAt: new Date() });
  task.status = 'settlement';
  await task.save();

  await Activity.create({
    agentId,
    taskId: task._id!.toString(),
    action: 'WORK_SUBMITTED',
  });

  // ── Auto-settle payment via on-chain escrow release on Arc testnet ──
  const escrow = getEscrowService();
  let settlementHash: string | null = null;

  if (escrow && task.escrowStatus === 'held') {
    try {
      // Release funds to the escrow wallet (owner) — in production this would go to the agent's address
      const recipient = escrow.address;
      console.log(`[Settlement] 💸 Releasing ${task.escrowAmount} USDC on-chain for task ${task._id}…`);

      const txResult = await escrow.release(task._id!.toString(), recipient);
      settlementHash = txResult.txHash;

      task.escrowStatus = 'released';
      task.settlementHash = settlementHash;
      task.settlementTxId = txResult.explorerUrl;
      task.settledAt = new Date();
      task.status = 'completed';
      await task.save();

      await Activity.create({
        agentId: 'ARC_ESCROW',
        taskId: task._id!.toString(),
        action: `PAYMENT_SETTLED — ${task.escrowAmount} USDC — ${settlementHash}`,
      });

      console.log(`[Settlement] ✅ On-chain release confirmed — ${txResult.explorerUrl}`);

      // ── Nitrolite off-chain settlement via Yellow Network state channel ──
      const nitrolite = getNitroliteService();
      if (nitrolite && nitrolite.isAuthenticated) {
        try {
          // Convert USDC amount to micro-units (6 decimals for ytest.usd)
          const microAmount = String(Math.round((task.escrowAmount ?? 0) * 1e6));
          console.log(`[Nitrolite] 💸 Settling ${task.escrowAmount} USDC via state channel (${microAmount} ytest.usd)…`);

          const nitroResult = await nitrolite.transfer(
            recipient as `0x${string}`,
            'ytest.usd',
            microAmount,
          );

          // Extract settlement ID from the Nitrolite RPC response
          const nitroId = nitroResult?.res?.[0]
            ?? JSON.stringify(nitroResult).slice(0, 120);
          task.nitroliteSettlementId = String(nitroId);
          await task.save();

          await Activity.create({
            agentId: 'NITROLITE',
            taskId: task._id!.toString(),
            action: `NITROLITE_SETTLED — ${task.escrowAmount} USDC — ID: ${String(nitroId).slice(0, 40)}`,
          });

          console.log(`[Nitrolite] ✅ State channel settlement complete — ID: ${String(nitroId)}`);
        } catch (nitroErr: any) {
          console.warn(`[Nitrolite] ⚠️  Off-chain settlement failed (non-fatal): ${nitroErr.message}`);
          await Activity.create({
            agentId: 'NITROLITE',
            taskId: task._id!.toString(),
            action: `NITROLITE_SETTLEMENT_FAILED — ${nitroErr.message?.slice(0, 80)}`,
          });
        }
      } else {
        console.log('[Nitrolite] ℹ️  Nitrolite not connected — skipping off-chain settlement');
      }

      // ── Update ENS text records with new reputation data ──
      const ensRegistry = getENSRegistryService();
      if (ensRegistry) {
        try {
          const agent = await Agent.findById(agentId);
          if (agent?.ensName) {
            // Increment tasks completed
            agent.tasksCompleted = (agent.tasksCompleted ?? 0) + 1;
            // Boost reputation (capped at 100)
            agent.reputation = Math.min(100, (agent.reputation ?? 50) + 2);
            await agent.save();

            // Write updated reputation to ENS text records on-chain
            const ensTx = await ensRegistry.updateReputation(
              agent.ensName,
              agent.reputation,
              agent.tasksCompleted,
              agent.tasksFailed ?? 0,
            );
            if (ensTx) {
              console.log(`[Settlement] 📝 ENS reputation updated for ${agent.ensName} — ${ensTx.explorerUrl}`);
            }
          }
        } catch (ensErr: any) {
          console.warn(`[Settlement] ⚠️  ENS reputation update failed (non-fatal):`, ensErr.message);
        }
      }
    } catch (err: any) {
      console.error('[Settlement] ❌ On-chain release failed:', err.message);
      task.status = 'review';
      await task.save();

      await Activity.create({
        agentId: 'ARC_ESCROW',
        taskId: task._id!.toString(),
        action: `SETTLEMENT_FAILED — ${err.message}`,
      });
    }
  } else if (!escrow) {
    console.warn('[Settlement] ⚠️  Escrow service not available — settlement skipped');
    task.status = 'review';
    await task.save();
  }

  res.json({ ...task.toObject(), id: task._id });
});

// POST /api/tasks/:id/refund — Process a refund for a task (creator only)
taskRouter.post('/:id/refund', async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const { callerAddress } = req.body;
  if (!callerAddress || task.creatorAddress.toLowerCase() !== callerAddress.toLowerCase()) {
    res.status(403).json({ error: 'Only the task creator can request a refund' });
    return;
  }

  if (task.escrowStatus !== 'held') {
    res.status(400).json({ error: `Cannot refund — escrow status is "${task.escrowStatus}"` });
    return;
  }

  // ── On-chain refund via Arc testnet ──
  const escrow = getEscrowService();
  if (escrow) {
    try {
      console.log(`[Refund] 🔄 Refunding ${task.escrowAmount} USDC on-chain for task ${task._id}…`);
      const txResult = await escrow.refund(task._id!.toString());

      task.escrowStatus = 'refunded';
      task.status = 'reversed';
      task.settlementHash = txResult.txHash;
      task.settlementTxId = txResult.explorerUrl;
      task.settledAt = new Date();
      await task.save();

      await Activity.create({
        agentId: 'ARC_ESCROW',
        taskId: task._id!.toString(),
        action: `REFUND_PROCESSED — ${task.escrowAmount} USDC — ${txResult.txHash}`,
      });

      console.log(`[Refund] ✅ On-chain refund confirmed — ${txResult.explorerUrl}`);
    } catch (err: any) {
      console.error('[Refund] ❌ On-chain refund failed:', err.message);
      res.status(500).json({ error: `On-chain refund failed: ${err.message}` });
      return;
    }
  } else {
    res.status(503).json({ error: 'Escrow service not available' });
    return;
  }

  res.json({ ...task.toObject(), id: task._id });
});
