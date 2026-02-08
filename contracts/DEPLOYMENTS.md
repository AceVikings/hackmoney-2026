# ACN — Deployed Contract Addresses

## Arc Testnet (Chain ID: 5042002)

> **Note:** Arc testnet uses USDC as native gas — no MockUSDC needed.
> For future deploys, pass the native USDC token address to ACNLiability.

| Contract | Address | Sourcify |
|----------|---------|----------|
| AgentIdentity | `0xEea9f969Be81cFFF70a6B68F6146E0A029F7C26E` | [✅ Verified](https://sourcify.dev/server/repo-ui/5042002/0xEea9f969Be81cFFF70a6B68F6146E0A029F7C26E) |
| AgentReputation | `0xec072Ea4Ad797a751a951a8fFDcA228812c44f0d` | [✅ Verified](https://sourcify.dev/server/repo-ui/5042002/0xec072Ea4Ad797a751a951a8fFDcA228812c44f0d) |
| ACNLiability | `0x4b8d05734E77E7475a02624B1DC3968Ff4feec8E` | [✅ Verified](https://sourcify.dev/server/repo-ui/5042002/0x4b8d05734E77E7475a02624B1DC3968Ff4feec8E) |

## Constructor Args

- **ACNLiability** takes `(address _usdc, address _reputation)`:
  - `_usdc` → Use Arc native USDC token address for production deploys
  - `_reputation` → AgentReputation: `0xec072Ea4Ad797a751a951a8fFDcA228812c44f0d`

## Nitrolite

- Wallet: `0x9cC437E2c917B30f7CB9996f61452d0b401c168a`
- ClearNode: `wss://clearnet-sandbox.yellow.com/ws` (Yellow sandbox)

## RPC

```
https://rpc.testnet.arc.network
```
