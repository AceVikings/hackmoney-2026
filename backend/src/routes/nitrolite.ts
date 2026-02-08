import { Router } from 'express';
import { getNitroliteService } from '../services/nitrolite.js';
import { NitroliteChannel } from '../models.js';

export const nitroliteRouter = Router();

// GET /api/nitrolite/status — Check Nitrolite connection status
nitroliteRouter.get('/status', (_req, res) => {
  const svc = getNitroliteService();
  if (!svc) {
    res.json({
      enabled: false,
      connected: false,
      authenticated: false,
      message: 'Nitrolite service not initialised (NITROLITE_PRIVATE_KEY not set)',
    });
    return;
  }
  res.json({ enabled: true, ...svc.getStatus() });
});

// GET /api/nitrolite/config — Get ClearNode configuration
nitroliteRouter.get('/config', async (_req, res) => {
  const svc = getNitroliteService();
  if (!svc || !svc.isAuthenticated) {
    res.status(503).json({ error: 'Nitrolite not connected' });
    return;
  }
  try {
    const config = await svc.getConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nitrolite/channels — List all channels
nitroliteRouter.get('/channels', async (_req, res) => {
  const svc = getNitroliteService();
  if (!svc || !svc.isAuthenticated) {
    // Fall back to DB records
    const channels = await NitroliteChannel.find().sort({ createdAt: -1 }).lean();
    res.json({ source: 'db', channels });
    return;
  }
  try {
    const channels = await svc.getChannels();
    res.json({ source: 'clearnode', channels });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nitrolite/balances — Get ledger balances
nitroliteRouter.get('/balances', async (_req, res) => {
  const svc = getNitroliteService();
  if (!svc || !svc.isAuthenticated) {
    res.status(503).json({ error: 'Nitrolite not connected' });
    return;
  }
  try {
    const balances = await svc.getLedgerBalances();
    res.json(balances);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/nitrolite/reconnect — Retry Nitrolite connection
nitroliteRouter.post('/reconnect', async (_req, res) => {
  const svc = getNitroliteService();
  if (!svc) {
    res.status(503).json({ error: 'Nitrolite service not initialised' });
    return;
  }
  if (svc.isAuthenticated) {
    res.json({ status: 'already_connected', ...svc.getStatus() });
    return;
  }
  try {
    await svc.reconnect();
    res.json({ status: 'connected', ...svc.getStatus() });
  } catch (err: any) {
    res.status(500).json({ error: `Reconnect failed: ${err.message}`, ...svc.getStatus() });
  }
});

// GET /api/nitrolite/transactions — Get ledger transaction history
nitroliteRouter.get('/transactions', async (_req, res) => {
  const svc = getNitroliteService();
  if (!svc || !svc.isAuthenticated) {
    res.status(503).json({ error: 'Nitrolite not connected' });
    return;
  }
  try {
    const txs = await svc.getLedgerTransactions();
    res.json(txs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
