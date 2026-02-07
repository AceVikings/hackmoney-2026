import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { tasks, type Task, activities } from '../store.js';

export const taskRouter = Router();

// GET /api/tasks — List all tasks (Results hidden)
taskRouter.get('/', (req, res) => {
  const requesterAddress = req.query.address as string;
  const taskList = Array.from(tasks.values()).map(task => {
    // If asking as the requester, show results. Otherwise hide.
    const isRequester = requesterAddress && task.creatorAddress.toLowerCase() === requesterAddress.toLowerCase();
    const { workResults, ...publicTask } = task;
    return isRequester ? task : { ...publicTask, hasResults: !!workResults?.length };
  });
  res.json(taskList);
});

// GET /api/tasks/:id — Get single task
taskRouter.get('/:id', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  
  const requesterAddress = req.query.address as string;
  const isRequester = requesterAddress && task.creatorAddress.toLowerCase() === requesterAddress.toLowerCase();
  
  if (isRequester) {
    res.json(task);
  } else {
    const { workResults, ...publicTask } = task;
    res.json(publicTask);
  }
});

// POST /api/tasks — Create a new task
taskRouter.post('/', (req, res) => {
  const { title, description, budget, creatorAddress } = req.body;

  if (!title || !budget || !creatorAddress) {
    res.status(400).json({ error: 'title, budget, and creatorAddress are required' });
    return;
  }

  const id = uuid();
  const task: Task = {
    id,
    title,
    description: description ?? '',
    budget,
    status: 'open',
    creatorAddress,
    assignedAgents: [],
    createdAt: new Date().toISOString(),
  };

  tasks.set(id, task);
  res.status(201).json(task);
});

// POST /api/tasks/:id/work — Submit work proof
taskRouter.post('/:id/work', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const { agentId, result } = req.body;
  
  if (!task.workResults) task.workResults = [];
  task.workResults.push({
    agentId,
    result,
    submittedAt: new Date().toISOString()
  });

  task.status = 'review';
  
  // Log activity
  activities.push({
    id: uuid(),
    agentId,
    taskId: task.id,
    action: 'SUBMITTED_WORK',
    timestamp: new Date().toISOString()
  });

  tasks.set(task.id, task);
  res.json({ success: true });
});

// GET /api/tasks/activity — Get public activity feed
taskRouter.get('/activity/feed', (_req, res) => {
  res.json(activities.slice(-20).reverse());
});

// PATCH /api/tasks/:id/status — Update task status
taskRouter.patch('/:id/status', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const { status } = req.body;
  const validStatuses = ['open', 'in-progress', 'review', 'settlement', 'completed', 'reversed'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    return;
  }

  task.status = status;
  tasks.set(task.id, task);
  res.json(task);
});
