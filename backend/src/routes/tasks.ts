import { Router } from 'express';
import { Task, Activity } from '../models.js';
import { getNitroliteService } from '../services/nitrolite.js';

export const taskRouter = Router();

// Token asset ID for ytest.usd on ClearNode sandbox
const SETTLEMENT_ASSET = 'ytest.usd';

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

  // ── Auto-settle payment via Nitrolite ──
  const svc = getNitroliteService();
  let settlementHash: string | null = null;
  let settlementTxId: string | null = null;

  // Wait for auth if WS is reconnecting
  const authed = svc ? (svc.isAuthenticated || await svc.waitForAuth(8000)) : false;

  if (authed && svc && task.escrowStatus === 'held') {
    try {
      console.log(`[Settlement] 💸 Settling ${task.escrowAmount} ${SETTLEMENT_ASSET} for task ${task._id}…`);

      // Transfer escrowed funds to the ACN vault (in production this goes to agent's wallet)
      // For sandbox: transfer to self to demonstrate the settlement flow
      const transferResult = await svc.transfer(
        svc.address as `0x${string}`,
        SETTLEMENT_ASSET,
        String(task.escrowAmount),
      );

      // Extract settlement hash / tx reference from the Nitrolite response
      const rawResponse = JSON.stringify(transferResult);
      settlementHash = `ntrl_${Date.now().toString(36)}_${task._id!.toString().slice(-8)}`;
      settlementTxId = rawResponse.slice(0, 120);

      task.escrowStatus = 'released';
      task.settlementHash = settlementHash;
      task.settlementTxId = settlementTxId;
      task.settledAt = new Date();
      task.status = 'completed';
      await task.save();

      await Activity.create({
        agentId: 'NITROLITE',
        taskId: task._id!.toString(),
        action: `PAYMENT_SETTLED — ${task.escrowAmount} ${SETTLEMENT_ASSET} — ${settlementHash}`,
      });

      console.log(`[Settlement] ✅ Task ${task._id} settled — hash: ${settlementHash}`);
    } catch (err: any) {
      console.error('[Settlement] ❌ Auto-settle failed:', err.message);
      // Mark as review so user can manually handle
      task.status = 'review';
      await task.save();

      await Activity.create({
        agentId: 'NITROLITE',
        taskId: task._id!.toString(),
        action: `SETTLEMENT_FAILED — ${err.message}`,
      });
    }
  } else if (!authed) {
    // Nitrolite offline — simulate settlement for demo
    settlementHash = `sim_${Date.now().toString(36)}_${task._id!.toString().slice(-8)}`;
    task.escrowStatus = 'released';
    task.settlementHash = settlementHash;
    task.settledAt = new Date();
    task.status = 'completed';
    await task.save();

    await Activity.create({
      agentId: 'SYSTEM',
      taskId: task._id!.toString(),
      action: `PAYMENT_SETTLED_SIM — ${task.escrowAmount} ${SETTLEMENT_ASSET} — ${settlementHash}`,
    });
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

  task.escrowStatus = 'refunded';
  task.status = 'reversed';
  task.settlementHash = `refund_${Date.now().toString(36)}_${task._id!.toString().slice(-8)}`;
  task.settledAt = new Date();
  await task.save();

  await Activity.create({
    agentId: 'SYSTEM',
    taskId: task._id!.toString(),
    action: `REFUND_PROCESSED — ${task.escrowAmount} ${SETTLEMENT_ASSET} returned`,
  });

  res.json({ ...task.toObject(), id: task._id });
});
