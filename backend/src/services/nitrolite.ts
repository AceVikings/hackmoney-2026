/**
 * Nitrolite / Yellow Network Sandbox Integration
 *
 * Connects to the Yellow ClearNode WebSocket (sandbox environment)
 * for state-channel based escrow and commitment settlement.
 *
 * Auth flow (per Yellow SDK tutorials):
 *   1. Generate ephemeral session key (viem generatePrivateKey)
 *   2. Send auth_request  { address, session_key, application, … }
 *   3. Receive auth_challenge from ClearNode
 *   4. Sign challenge with EIP-712 using main wallet (createEIP712AuthMessageSigner)
 *   5. Send auth_verify → receive auth success
 *   6. Use ECDSA session signer for all subsequent RPC calls
 *
 * Reference: https://github.com/stevenzeiler/yellow-sdk-tutorials
 */
import WebSocket from 'ws';
import {
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createEIP712AuthMessageSigner,
  createECDSAMessageSigner,
  createGetConfigMessage,
  createGetChannelsMessage,
  createGetLedgerBalancesMessage,
  createGetLedgerTransactionsMessage,
  createTransferMessage,
  parseAnyRPCResponse,
  generateRequestId,
  RPCMethod,
  type NitroliteRPCMessage,
} from '@erc7824/nitrolite';
import {
  createWalletClient,
  http,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { base } from 'viem/chains';
import { NitroliteChannel } from '../models.js';

// ── Types ──────────────────────────────────────────────

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface NitroliteConfig {
  privateKey: string;
  clearNodeUrl: string;
}

interface SessionKey {
  privateKey: `0x${string}`;
  address: `0x${string}`;
}

// ── Constants ──────────────────────────────────────────

const MAX_RECONNECT_ATTEMPTS = 10;
const AUTH_TIMEOUT_MS = 15_000;
const PING_INTERVAL_MS = 25_000; // keep-alive ping every 25s
const SESSION_DURATION = 86400; // 24 hours
const APP_NAME = 'ACN';
const AUTH_SCOPE = 'console';

// ── Service ────────────────────────────────────────────

export class NitroliteService {
  private ws: WebSocket | null = null;
  private walletClient: WalletClient;
  private walletAddress: `0x${string}`;
  private clearNodeUrl: string;
  private authenticated = false;
  private pendingRequests = new Map<number, PendingRequest>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;

  // Session key — ephemeral key used for post-auth RPC signing
  private sessionKey: SessionKey;
  private sessionSigner: ReturnType<typeof createECDSAMessageSigner>;
  private sessionExpireTimestamp!: string;

  // Auth callbacks (resolved once auth_verify comes back)
  private _authResolve: (() => void) | null = null;
  private _authReject: ((err: Error) => void) | null = null;

  constructor(config: NitroliteConfig) {
    const privateKeyHex = config.privateKey as `0x${string}`;
    this.clearNodeUrl = config.clearNodeUrl;

    // Create viem wallet client from the main private key
    const account = privateKeyToAccount(privateKeyHex);
    this.walletAddress = account.address;
    this.walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(),
    });

    // Generate ephemeral session key (separate from main wallet)
    const sessionPrivateKey = generatePrivateKey();
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);
    this.sessionKey = {
      privateKey: sessionPrivateKey,
      address: sessionAccount.address,
    };

    // ECDSA signer for post-auth RPC calls (uses session key)
    this.sessionSigner = createECDSAMessageSigner(this.sessionKey.privateKey);

    console.log(`[Nitrolite] Wallet address: ${this.walletAddress}`);
    console.log(`[Nitrolite] Session key:    ${this.sessionKey.address}`);
  }

  // ── Connection ──

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[Nitrolite] Connecting to ${this.clearNodeUrl}…`);
      this.ws = new WebSocket(this.clearNodeUrl);

      this.ws.on('open', async () => {
        console.log('[Nitrolite] ✅ WebSocket connected');
        try {
          await this.authenticate();
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      this.ws.on('message', (data) => this.handleMessage(data.toString()));

      this.ws.on('close', () => {
        console.log('[Nitrolite] WebSocket closed');
        this.authenticated = false;
        this.stopPing();
        if (!this.reconnectTimer && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts++;
          const delay = 5_000 * this.reconnectAttempts;
          console.log(`[Nitrolite] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})…`);
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect().catch((e) =>
              console.error('[Nitrolite] Reconnect failed:', e.message),
            );
          }, delay);
        } else if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.warn('[Nitrolite] ⚠️  Max reconnect attempts reached. Nitrolite offline.');
          console.warn('[Nitrolite] Register wallet: curl -XPOST https://clearnet-sandbox.yellow.com/faucet/requestTokens -H "Content-Type: application/json" -d \'{"userAddress":"' + this.walletAddress + '"}\'');
        }
      });

      this.ws.on('error', (err) => {
        console.error('[Nitrolite] WebSocket error:', err.message);
      });
    });
  }

  // ── Authentication (EIP-712 challenge-response per Yellow SDK) ──

  private async authenticate(): Promise<void> {
    this.sessionExpireTimestamp = String(Math.floor(Date.now() / 1000) + SESSION_DURATION);

    // Step 1: Send auth_request with ephemeral session key address
    const authRequestMsg = await createAuthRequestMessage({
      address: this.walletAddress,
      session_key: this.sessionKey.address,
      application: APP_NAME,
      allowances: [],
      expires_at: BigInt(this.sessionExpireTimestamp),
      scope: AUTH_SCOPE,
    });
    this.send(authRequestMsg);

    // Step 2: Wait for auth_challenge → sign with EIP-712 → auth_verify → auth_success
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._authResolve = null;
        this._authReject = null;
        reject(new Error('Auth timeout'));
      }, AUTH_TIMEOUT_MS);
      this._authResolve = () => { clearTimeout(timeout); resolve(); };
      this._authReject = (err: Error) => { clearTimeout(timeout); reject(err); };
    });
  }

  // ── Message Handling ──

  private handleMessage(raw: string): void {
    try {
      // Use the SDK's own parser to get typed responses
      const response = parseAnyRPCResponse(raw);

      // ── Auth Challenge → sign with EIP-712 and verify ──
      if (response.method === RPCMethod.AuthChallenge) {
        this.handleAuthChallenge(response).catch((e) => {
          console.error('[Nitrolite] Auth challenge handling failed:', e);
          this._authReject?.(e);
        });
        return;
      }

      // ── Auth Verify → success ──
      if (response.method === RPCMethod.AuthVerify) {
        console.log('[Nitrolite] ✅ Authenticated with ClearNode');
        this.authenticated = true;
        this.reconnectAttempts = 0;
        this.startPing();
        this._authResolve?.();
        return;
      }

      // ── Error ──
      if (response.method === RPCMethod.Error) {
        const errMsg = (response.params as any)?.error || raw.slice(0, 300);
        console.error('[Nitrolite] Error from ClearNode:', errMsg);
        // If we're still authenticating, reject the auth promise
        if (!this.authenticated && this._authReject) {
          this._authReject(new Error(`ClearNode error: ${errMsg}`));
          this._authResolve = null;
          this._authReject = null;
        }
        return;
      }

      // ── Assets / Balance / Channels updates ──
      if (response.method === RPCMethod.Assets) {
        console.log('[Nitrolite] Assets info received');
        return;
      }
      if (response.method === RPCMethod.BalanceUpdate) {
        console.log('[Nitrolite] Balance update:', (response.params as any));
        return;
      }
      if (response.method === RPCMethod.ChannelsUpdate) {
        console.log('[Nitrolite] Channels update:', (response.params as any));
        return;
      }

      // ── Match pending RPC requests by requestId ──
      const msg: NitroliteRPCMessage = JSON.parse(raw);
      if (msg?.res && Array.isArray(msg.res)) {
        const [requestId] = msg.res;
        if (typeof requestId === 'number' && this.pendingRequests.has(requestId)) {
          const pending = this.pendingRequests.get(requestId)!;
          this.pendingRequests.delete(requestId);
          clearTimeout(pending.timeout);
          pending.resolve(msg);
          return;
        }
      }

      // Fallback
      console.log('[Nitrolite] Received:', raw.slice(0, 200));
    } catch (e) {
      console.error('[Nitrolite] Failed to parse message:', raw.slice(0, 200));
    }
  }

  private async handleAuthChallenge(challengeResponse: any): Promise<void> {
    try {
      console.log('[Nitrolite] Received auth_challenge — signing with EIP-712…');

      // Build auth params matching the original auth_request
      const authParams = {
        scope: AUTH_SCOPE,
        application: this.walletAddress,
        participant: this.sessionKey.address,
        expire: this.sessionExpireTimestamp,
        allowances: [] as any[],
        session_key: this.sessionKey.address,
        expires_at: BigInt(this.sessionExpireTimestamp),
      };

      // Create EIP-712 signer using the MAIN wallet (not the session key)
      const eip712Signer = createEIP712AuthMessageSigner(
        this.walletClient,
        authParams,
        { name: APP_NAME },
      );

      // Sign the challenge and create the auth_verify message
      const authVerifyMsg = await createAuthVerifyMessage(
        eip712Signer,
        challengeResponse,
      );

      this.send(authVerifyMsg);
      console.log('[Nitrolite] Auth verify message sent');
    } catch (err: any) {
      console.error('[Nitrolite] Auth challenge error:', err);
      this._authReject?.(err);
    }
  }

  // ── RPC helpers ──

  /** Keep-alive: ping the WebSocket to avoid idle disconnects */
  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Wait up to `ms` for authentication to complete (useful when WS is reconnecting).
   */
  async waitForAuth(ms = 10_000): Promise<boolean> {
    if (this.authenticated) return true;
    const start = Date.now();
    while (Date.now() - start < ms) {
      await new Promise((r) => setTimeout(r, 500));
      if (this.authenticated) return true;
    }
    return false;
  }

  private send(msg: string | object): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    const payload = typeof msg === 'string' ? msg : JSON.stringify(msg);
    this.ws.send(payload);
  }

  private async rpc(msgPromise: Promise<string> | string, timeoutMs = 10_000): Promise<any> {
    const msg = typeof msgPromise === 'string' ? msgPromise : await msgPromise;
    const parsed: NitroliteRPCMessage = JSON.parse(msg);
    const requestId = parsed.req?.[0] ?? generateRequestId();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId as number);
        reject(new Error(`RPC timeout for id=${requestId}`));
      }, timeoutMs);

      this.pendingRequests.set(requestId as number, { resolve, reject, timeout });
      this.send(msg);
    });
  }

  // ── Public API ──

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get isAuthenticated(): boolean {
    return this.authenticated;
  }

  get address(): string {
    return this.walletAddress;
  }

  /** Fetch ClearNode configuration (supported tokens, chains, etc.) */
  async getConfig(): Promise<any> {
    if (!this.authenticated) throw new Error('Not authenticated');
    return this.rpc(createGetConfigMessage(this.sessionSigner));
  }

  /** Fetch available channels */
  async getChannels(): Promise<any> {
    if (!this.authenticated) throw new Error('Not authenticated');
    return this.rpc(
      createGetChannelsMessage(this.sessionSigner, this.walletAddress),
    );
  }

  /** Fetch ledger balances */
  async getLedgerBalances(): Promise<any> {
    if (!this.authenticated) throw new Error('Not authenticated');
    return this.rpc(createGetLedgerBalancesMessage(this.sessionSigner));
  }

  /** Fetch ledger transaction history */
  async getLedgerTransactions(): Promise<any> {
    if (!this.authenticated) throw new Error('Not authenticated');
    return this.rpc(
      createGetLedgerTransactionsMessage(this.sessionSigner, this.walletAddress),
    );
  }

  /**
   * Transfer tokens to a destination address via ClearNode ledger.
   * Uses the Nitrolite `transfer` RPC method.
   * @returns The raw RPC response including any settlement / tx hash
   */
  async transfer(
    destinationAddress: `0x${string}`,
    asset: string,
    amount: string,
  ): Promise<any> {
    if (!this.authenticated) throw new Error('Not authenticated');
    console.log(`[Nitrolite] 💸 Transferring ${amount} ${asset} → ${destinationAddress}`);
    const result = await this.rpc(
      createTransferMessage(this.sessionSigner, {
        destination: destinationAddress,
        allocations: [{ asset, amount }],
      }),
    );
    console.log('[Nitrolite] ✅ Transfer complete:', JSON.stringify(result).slice(0, 300));
    return result;
  }

  /** Get service status */
  getStatus() {
    return {
      connected: this.isConnected,
      authenticated: this.isAuthenticated,
      address: this.walletAddress,
      sessionKeyAddress: this.sessionKey.address,
      clearNodeUrl: this.clearNodeUrl,
    };
  }

  /** Reconnect from scratch (resets reconnect attempts) */
  async reconnect(): Promise<void> {
    this.disconnect();
    this.reconnectAttempts = 0;
    await this.connect();
  }

  /** Graceful disconnect */
  disconnect(): void {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.authenticated = false;
    console.log('[Nitrolite] Disconnected');
  }
}

// ── Singleton ──────────────────────────────────────────

let instance: NitroliteService | null = null;

export function getNitroliteService(): NitroliteService | null {
  return instance;
}

/**
 * Initialise the Nitrolite service with Yellow sandbox environment.
 * Call once at server startup after env vars are loaded.
 */
export async function initNitrolite(): Promise<NitroliteService | null> {
  const privateKey = process.env.NITROLITE_PRIVATE_KEY;
  const clearNodeUrl = process.env.YELLOW_CLEARNODE_WS || 'wss://clearnet-sandbox.yellow.com/ws';

  if (!privateKey) {
    console.warn('[Nitrolite] ⚠️  NITROLITE_PRIVATE_KEY not set — skipping Nitrolite init');
    return null;
  }

  instance = new NitroliteService({ privateKey, clearNodeUrl });

  try {
    await instance.connect();
    return instance;
  } catch (err: any) {
    console.error('[Nitrolite] Failed to initialise:', err.message);
    // Clean up the WebSocket so it doesn't leave zombie connections
    instance.disconnect();
    console.warn('[Nitrolite] ⚠️  Nitrolite offline — register wallet via sandbox faucet to enable state channels');
    return null;
  }
}
