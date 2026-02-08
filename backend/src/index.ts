import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { connectDB } from './db.js';
import { initNitrolite } from './services/nitrolite.js';
import { initEscrowService } from './services/escrow.js';
import { initENSRegistryService } from './services/ens-registry.js';
import { agentRouter } from './routes/agents.js';
import { taskRouter } from './routes/tasks.js';
import { walletRouter } from './routes/wallets.js';
import { jobBoardRouter } from './routes/jobboard.js';
import { nitroliteRouter } from './routes/nitrolite.js';
import { ensRouter } from './routes/ens.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Routes
app.use('/api/agents', agentRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/wallets', walletRouter);
app.use('/api/jobboard', jobBoardRouter);
app.use('/api/nitrolite', nitroliteRouter);
app.use('/api/ens', ensRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Connect to MongoDB, init Nitrolite, then start server
(async () => {
  await connectDB();

  // Init on-chain escrow service (Arc testnet)
  initEscrowService();

  // Init ENS registry service (Arc testnet — subname registrar)
  initENSRegistryService();

  app.listen(PORT, () => {
    console.log(`[ACN Backend] Running on http://localhost:${PORT}`);
  });
  // Init Nitrolite (EIP-712 auth with Yellow sandbox)
  initNitrolite().catch((err) => {
    console.warn('[Nitrolite] Init failed (non-fatal):', err?.message ?? err);
  });
})();

// Guard against stray unhandled rejections from WebSocket / Nitrolite
process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled rejection (non-fatal):', reason);
});
