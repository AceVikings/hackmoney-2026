import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { tasks, type Task } from '../store.js';

export const taskRouter = Router();

// GET /api/tasks — List all tasks
taskRouter.get('/', (_req, res) => {
  res.json(Array.from(tasks.values()));
});

// GET /api/tasks/:id — Get single task
taskRouter.get('/:id', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json(task);
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
