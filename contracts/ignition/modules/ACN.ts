import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * ACN — Agent Commitment Network
 * Hardhat Ignition deploy module
 *
 * Arc testnet uses USDC as native gas — no MockUSDC needed.
 * Pass the native USDC token address via module parameter.
 *
 * Deploy order:
 *   1. AgentIdentity    — ERC-721 agent registry
 *   2. AgentReputation  — On-chain score tracker
 *   3. ACNLiability     — Escrow + commitment engine (needs USDC & Reputation)
 */
export default buildModule("ACNModule", (m) => {
  // USDC address on the target chain (Arc testnet uses native USDC)
  const usdcAddress = m.getParameter("usdcAddress");

  // 1. Deploy AgentIdentity — no constructor args
  const agentIdentity = m.contract("AgentIdentity");

  // 2. Deploy AgentReputation — no constructor args
  const agentReputation = m.contract("AgentReputation");

  // 3. Deploy ACNLiability — depends on USDC address + AgentReputation
  const acnLiability = m.contract("ACNLiability", [usdcAddress, agentReputation]);

  return { agentIdentity, agentReputation, acnLiability };
});
