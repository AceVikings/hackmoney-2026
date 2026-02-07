import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { agentRouter } from './routes/agents.js';
import { taskRouter } from './routes/tasks.js';
import { walletRouter } from './routes/wallets.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// Routes
app.use('/api/agents', agentRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/wallets', walletRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[ACN Backend] Running on http://localhost:${PORT}`);
});
