/**
 * ENS Registry API Routes
 *
 * Exposes the ACNRegistry contract data via REST endpoints.
 * Allows querying subname info, text records, and registration status.
 */
import { Router } from 'express';
import { getENSRegistryService, ACN_RECORD_KEYS } from '../services/ens-registry.js';

export const ensRouter = Router();

// GET /api/ens/status — Registry service status
ensRouter.get('/status', async (_req, res) => {
  const ens = getENSRegistryService();
  if (!ens) {
    res.status(503).json({ error: 'ENS registry service not available' });
    return;
  }

  const totalRegistered = await ens.getTotalRegistered();
  res.json({
    ...ens.getStatus(),
    totalRegistered,
  });
});

// GET /api/ens/lookup/:ensName — Look up a subname and its text records
ensRouter.get('/lookup/:ensName', async (req, res) => {
  const ens = getENSRegistryService();
  if (!ens) {
    res.status(503).json({ error: 'ENS registry service not available' });
    return;
  }

  const { ensName } = req.params;

  try {
    const info = await ens.getSubnameInfo(ensName);
    if (!info) {
      res.status(404).json({ error: `Subname "${ensName}" not registered` });
      return;
    }

    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ens/registered/:ensName — Check if a subname is registered
ensRouter.get('/registered/:ensName', async (req, res) => {
  const ens = getENSRegistryService();
  if (!ens) {
    res.status(503).json({ error: 'ENS registry service not available' });
    return;
  }

  const { ensName } = req.params;
  const registered = await ens.isRegistered(ensName);
  res.json({ ensName, registered });
});

// GET /api/ens/records/:ensName — Get all standard ACN text records for a subname
ensRouter.get('/records/:ensName', async (req, res) => {
  const ens = getENSRegistryService();
  if (!ens) {
    res.status(503).json({ error: 'ENS registry service not available' });
    return;
  }

  const { ensName } = req.params;

  try {
    const node = await ens.getNode(ensName);
    const records = await ens.getTextRecords(node, Object.values(ACN_RECORD_KEYS));

    res.json({
      ensName,
      node,
      records,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ens/record/:ensName/:key — Get a single text record
ensRouter.get('/record/:ensName/:key', async (req, res) => {
  const ens = getENSRegistryService();
  if (!ens) {
    res.status(503).json({ error: 'ENS registry service not available' });
    return;
  }

  const { ensName, key } = req.params;

  try {
    const node = await ens.getNode(ensName);
    const value = await ens.getTextRecord(node, key);

    res.json({ ensName, key, value });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
