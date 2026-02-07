# Implementation Plan: Agent Commitment Network (ACN) with EIP-8004

This plan details the technical roadmap for building ACN, leveraging the **EIP-8004 (Trustless Agents)** standard for identity and reputation, while using Yellow Network and Circle WaaS for the financial execution.

## Phase 1: Core Financial Infrastructure (Week 1)

### 1.1 Yellow Nitrolite State Channels
- **Component**: `ACNApp.sol` (Contract)
- **Description**: Inherits from `IForceMoveApp`.
    - `appData` logic: `{ commitmentId, reversalDeadline, workerProofHash, agentId }`.
    - **Logic**: Enforces turn-based reversal rules. Payer can reverse funds before `reversalDeadline`.
- **Backend**: Init Nitrolite SDK. Map `agentId` (EIP-8004) to Nitrolite keys.

### 1.2 Circle WaaS Integration
- **Component**: Agent Backend / Wallet Service.
- **Description**:
    - Provision Circle Developer-Controlled Wallets for each `agentId`.
    - **Action**: Implement "Auto-Funding" service to move USDC from Agent Wallet -> NitroAdjudicator.
    - **Security**: All state channel signatures are generated inside Circle's programmable wallet environment.

---

## Phase 2: EIP-8004 Identity & Reputation (Week 2)

### 2.1 Identity Registry (EIP-8004)
- **Component**: `IdentityRegistry.sol` (Standard Deployment)
- **Description**:
    - Replaces the simple `AgentRegistry` logic.
    - **Action**: Register agents by calling `register(agentURI)`.
    - **Metadata**: Store `agent.role`, `skills`, and `paymentAddress` (Circle Wallet) in the JSON profile pointed to by `agentURI`.
- **Frontend**: Update discovery UI to resolve `agentURI` and fetch metadata.

### 2.2 Reputation & Validation (EIP-8004)
- **Component**: `ReputationRegistry.sol` & `ValidationRegistry.sol`
- **Description**:
    - **Reputation**: Used for identifying "High Liability Cap" agents.
    - **Validation**:
        - **Post-Task**: When a commitment is finalized (settled), the "Parent" agent calls `giveFeedback` to the "Child" agent.
        - **Score**: `value` = % of budget kept (100 = success, 0 = full reversal).
- **Backend Integration**:
    - Automatically call `giveFeedback` after `NitroAdjudicator` pushes the final outcome.

---

## Phase 3: Liability & Orchestration (Week 3)

### 3.1 Liability Contract
- **Component**: `ACNLiability.sol` (Custom Contract on Arc)
- **Description**:
    - Maps `channelId` (Yellow) to `agentId` (EIP-8004).
    - **Liability Tree**: Tracks which `agentId` is the parent of a channel.
    - **Logic**: If `channelId` closes with a Reversal, `ACNLiability` records the loss against the Parent's credit limit.

### 3.2 Orchestrator (Skynet Prime)
- **Component**: Backend (Node.js/Python)
- **Description**:
    - **Discovery**: Query `IdentityRegistry` for agents with specific skills and `ReputationRegistry` score > X.
    - **Hiring**:
        1. Select Agent.
        2. Open Yellow Channel.
        3. Record edge in `ACNLiability`.

### 3.3 ACN Dashboard (Frontend)
- **Component**: React App
- **Features**:
    - **Agent Profile**: Show EIP-8004 Metadata + Reputation Score.
    - **Tree View**: Visualize the Liability Tree for a user's task.
    - **Dispute UI**: Interface to view `ValidationRegistry` requests for contested tasks.

---

## Phase 4: Integration & Settlement (Week 4)

### 4.1 End-to-End Flow
1.  **Register**: Agent creates Identity (EIP-8004).
2.  **Fund**: Agent deposits USDC (Circle) -> Adjudicator.
3.  **Hire**: Parent (Prime) opens channel with Child (Worker).
4.  **Work**: Child submits proof off-chain.
5.  **Review**: Parent verifies.
    - *Success*: Channel closes. Parent calls `giveFeedback(100)`.
    - *Fail*: Parent updates state to "Reversed". Channel closes. Parent calls `giveFeedback(0)`.
6.  **Settle**: Arc Chain records final balances.

### 4.2 Segregation Overview
| Layer | Tech | Responsibility |
| :--- | :--- | :--- |
| **Identity/Reputation** | **EIP-8004 Contracts** | Standardized discovery & trust scores. |
| **Financial State** | **Yellow Nitrolite** | Fast, reversible commitments (The "Money"). |
| **Wallet/Keys** | **Circle WaaS** | Secure signing & custody. |
| **Orchestration** | **Backend (LLM)** | Logic, planning, and task decomposition. |
| **Settlement** | **Arc Chain** | Final truth for USDC & Reputation. |

---

## Technical Stack Summary
- **Standards**: EIP-8004 (Identity/Reputation)
- **Blockchain**: Arc Chain (Testnet)
- **Off-chain**: Yellow Network (Nitrolite)
- **Wallets**: Circle WaaS
- **Language**: Solidity (Contracts), TypeScript (SDK/Backend)
