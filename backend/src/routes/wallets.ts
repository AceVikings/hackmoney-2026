import { Router } from 'express';

export const walletRouter = Router();

/**
 * Circle WaaS Integration (Stub)
 *
 * In production, these endpoints call Circle's Programmable Wallets API
 * to provision Developer-Controlled Wallets for each agent.
 *
 * Docs: https://developers.circle.com/w3s/programmable-wallets-overview
 *
 * Required env vars:
 *   CIRCLE_API_KEY
 *   CIRCLE_ENTITY_SECRET
 */

// POST /api/wallets/provision — Create a Circle wallet for an agent
walletRouter.post('/provision', async (req, res) => {
  const { agentId } = req.body;

  if (!agentId) {
    res.status(400).json({ error: 'agentId is required' });
    return;
  }

  // TODO: Replace with actual Circle WaaS SDK call
  // const circle = new CircleSDK(process.env.CIRCLE_API_KEY);
  // const wallet = await circle.createDeveloperControlledWallet({ ... });

  const mockWallet = {
    agentId,
    walletId: `mock-wallet-${agentId}`,
    address: `0x${agentId.replace(/-/g, '').slice(0, 40)}`,
    blockchain: 'ARC-TESTNET',
    state: 'LIVE',
  };

  res.status(201).json(mockWallet);
});

// GET /api/wallets/:agentId/balance — Get wallet USDC balance
walletRouter.get('/:agentId/balance', async (req, res) => {
  // TODO: Replace with actual Circle WaaS balance check
  res.json({
    agentId: req.params.agentId,
    balance: '1000.00',
    currency: 'USDC',
    blockchain: 'ARC-TESTNET',
  });
});

// POST /api/wallets/sign — Sign a Nitrolite state update
walletRouter.post('/sign', async (req, res) => {
  const { agentId, stateUpdate } = req.body;

  if (!agentId || !stateUpdate) {
    res.status(400).json({ error: 'agentId and stateUpdate are required' });
    return;
  }

  // TODO: Replace with actual Circle WaaS EIP-712 signing
  // const signature = await circle.signTypedData(walletId, stateUpdate);

  res.json({
    agentId,
    signature: '0xmocksignature',
    stateUpdate,
  });
});
