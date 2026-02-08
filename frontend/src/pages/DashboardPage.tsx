import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link } from 'react-router';
import { useEffect, useState } from 'react';
import {
  Activity as ActivityIcon,
  DollarSign,
  Users,
  Terminal,
  Shield,
  Hash,
  Zap,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import Card, { CardContent } from '../components/ui/Card';
import SectionHeading from '../components/ui/SectionHeading';
import Button from '../components/ui/Button';
import {
  fetchTasks,
  fetchActivityFeed,
  fetchNitroliteStatus,
  fetchNitroliteBalances,
  requestRefund,
  type Task,
  type Activity,
  type NitroliteStatus,
} from '../api/client';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'open': 'text-pewter border-pewter/30',
    'in-progress': 'text-gold border-gold/40',
    'review': 'text-cream border-cream/30',
    'settlement': 'text-green-400 border-green-400/30',
    'completed': 'text-green-500 border-green-500/50',
  };
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-[0.15em] border px-3 py-1 ${
        colors[status.toLowerCase()] ?? 'text-pewter border-pewter/30'
      }`}
    >
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [nitroStatus, setNitroStatus] = useState<NitroliteStatus | null>(null);
  const [nitroBalance, setNitroBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isConnected && address) {
      const load = async () => {
        try {
          const [t, a, ns] = await Promise.all([
            fetchTasks(address),
            fetchActivityFeed(address),
            fetchNitroliteStatus().catch(() => null),
          ]);
          setTasks(t);
          setActivities(a);
          if (ns) {
            setNitroStatus(ns);
            // Fetch live balance if authenticated
            if (ns.authenticated) {
              try {
                const bal = await fetchNitroliteBalances();
                // Parse balance from RPC response
                const raw = JSON.stringify(bal);
                // Try to extract a human-readable balance
                const amtMatch = raw.match(/"amount"\s*:\s*"?(\d+[\d.]*)"?/);
                setNitroBalance(amtMatch ? amtMatch[1] : raw.slice(0, 100));
              } catch {
                setNitroBalance('(fetch error)');
              }
            }
          }
        } catch (err) {
          console.error('Failed to load dashboard data', err);
        } finally {
          setLoading(false);
        }
      };
      load();
      const interval = setInterval(load, 5000);
      return () => clearInterval(interval);
    }
  }, [isConnected, address]);

  if (!isConnected) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 pt-24 text-center">
        <div className="h-16 w-16 rotate-45 border-2 border-gold/40 flex items-center justify-center mb-8">
          <ActivityIcon size={24} className="-rotate-45 text-gold" />
        </div>
        <h2 className="font-[Marcellus] text-2xl uppercase tracking-[0.2em] text-cream mb-4">
          Connect Your Wallet
        </h2>
        <p className="text-sm text-pewter mb-8 max-w-md">
          Connect your wallet to access the ACN dashboard and manage
          agent commitments.
        </p>
        <ConnectButton />
      </div>
    );
  }

  const stats = [
    { label: 'Active Commitments', value: tasks.filter(t => t.status !== 'completed' && t.status !== 'reversed').length.toString(), icon: ActivityIcon },
    { label: 'Total Escrowed', value: `${tasks.filter(t => t.escrowStatus === 'held').reduce((acc, t) => acc + (t.escrowAmount ?? 0), 0).toLocaleString()} USDC`, icon: Shield },
    { label: 'Total Settled', value: `${tasks.filter(t => t.escrowStatus === 'released').reduce((acc, t) => acc + (t.escrowAmount ?? 0), 0).toLocaleString()} USDC`, icon: DollarSign },
    { label: 'Agents Hired', value: [...new Set(tasks.flatMap(t => t.assignedAgents))].length.toString(), icon: Users },
  ];

  const handleRefund = async (taskId: string) => {
    if (!address) return;
    try {
      await requestRefund(taskId, address);
    } catch (err) {
      console.error('Refund failed', err);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="Dashboard"
          subtitle="Monitor your active commitments, liability trees, and agent operations."
        />

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {stats.map((s) => (
            <Card key={s.label} hover={false}>
              <CardContent className="text-center">
                <s.icon size={18} className="mx-auto text-gold/60 mb-2" />
                <p className="font-[Marcellus] text-2xl text-cream">
                  {s.value}
                </p>
                <p className="text-[10px] uppercase tracking-[0.15em] text-pewter mt-1">
                  {s.label}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* ── Active Tasks (Left 2/3) ── */}
          <div className="lg:col-span-2">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="font-[Marcellus] text-lg uppercase tracking-[0.15em] text-cream">
                Your Tasks
              </h3>
              <Button variant="outline" className="h-9 px-5 text-[10px]">
                <Link to="/jobs">+ Post Job</Link>
              </Button>
            </div>

            <div className="space-y-4">
              {loading && tasks.length === 0 ? (
                <p className="text-pewter text-sm animate-pulse">Loading tasks...</p>
              ) : tasks.length === 0 ? (
                <p className="text-pewter text-sm">No tasks found. Post a job to get started.</p>
              ) : (
                tasks.map((task) => (
                  <Card key={task.id} className="group">
                    <CardContent>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h4 className="font-[Marcellus] text-base uppercase tracking-[0.1em] text-cream">
                            {task.title}
                          </h4>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-gold">{task.budget} USDC</span>
                            {task.escrowStatus && task.escrowStatus !== 'none' && (
                              <span className={`text-xs flex items-center gap-1 ${
                                task.escrowStatus === 'held' ? 'text-amber-400' :
                                task.escrowStatus === 'released' ? 'text-emerald-400' :
                                task.escrowStatus === 'refunded' ? 'text-red-400' : 'text-pewter'
                              }`}>
                                <Shield size={10} />
                                {task.escrowAmount} {task.escrowStatus}
                              </span>
                            )}
                            <span className="text-xs text-pewter">
                              {new Date(task.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <StatusBadge status={task.status} />
                      </div>

                      {/* Escrow tx hash */}
                      {task.escrowTxHash && (
                        <div className="mt-4 flex items-center gap-2 bg-amber-500/5 border border-amber-500/20 px-3 py-2 text-xs">
                          <Shield size={12} className="text-amber-400 shrink-0" />
                          <span className="text-[10px] text-pewter uppercase tracking-wider mr-2">Escrow</span>
                          {task.escrowTxHash.startsWith('0x') ? (
                            <a
                              href={`https://testnet.arcscan.app/tx/${task.escrowTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-amber-400 font-mono truncate hover:text-amber-300 transition-colors flex items-center gap-1"
                            >
                              {task.escrowTxHash.slice(0, 10)}…{task.escrowTxHash.slice(-8)}
                              <ExternalLink size={10} className="shrink-0" />
                            </a>
                          ) : (
                            <span className="text-amber-400 font-mono truncate">{task.escrowTxHash}</span>
                          )}
                        </div>
                      )}

                      {/* Settlement hash */}
                      {task.settlementHash && (
                        <div className="mt-4 flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 px-3 py-2 text-xs">
                          <Hash size={12} className="text-emerald-400 shrink-0" />
                          <span className="text-[10px] text-pewter uppercase tracking-wider mr-2">Settlement</span>
                          {task.settlementHash.startsWith('0x') ? (
                            <a
                              href={`https://testnet.arcscan.app/tx/${task.settlementHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 font-mono truncate hover:text-emerald-300 transition-colors flex items-center gap-1"
                            >
                              {task.settlementHash.slice(0, 10)}…{task.settlementHash.slice(-8)}
                              <ExternalLink size={10} className="shrink-0" />
                            </a>
                          ) : (
                            <span className="text-emerald-400 font-mono truncate">{task.settlementHash}</span>
                          )}
                          {task.settledAt && (
                            <span className="text-pewter text-[10px] ml-auto shrink-0">
                              {new Date(task.settledAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Refund button for held escrow tasks */}
                      {task.escrowStatus === 'held' && (task.status === 'open' || task.status === 'in-progress') && (
                        <div className="mt-3">
                          <button
                            onClick={() => handleRefund(task.id)}
                            className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 uppercase tracking-wider transition-colors"
                          >
                            <RefreshCw size={10} /> Request Refund
                          </button>
                        </div>
                      )}

                      {/* Display results only if available */}
                      {task.workResults && task.workResults.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-gold/10">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-gold mb-4">Work Results</p>
                          <div className="space-y-4">
                            {task.workResults.map((res, i) => (
                              <div key={i} className="bg-midnight/50 p-4 border border-gold/5">
                                <p className="text-[10px] text-pewter mb-2">Agent ID: {res.agentId}</p>
                                <pre className="text-xs text-cream overflow-x-auto">
                                  {JSON.stringify(res.result, null, 2)}
                                </pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div className="space-y-10">
            {/* ── Nitrolite Status ── */}
            <div>
              <div className="mb-6">
                <h3 className="font-[Marcellus] text-lg uppercase tracking-[0.15em] text-cream flex items-center gap-2">
                  <Zap size={16} className="text-gold" /> Yellow Network
                </h3>
              </div>
              <Card hover={false}>
                <CardContent className="space-y-3">
                  {nitroStatus ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-pewter">Status</span>
                        <span className={`text-[10px] uppercase tracking-wider ${nitroStatus.authenticated ? 'text-emerald-400' : nitroStatus.connected ? 'text-amber-400' : 'text-red-400'}`}>
                          {nitroStatus.authenticated ? '● Connected' : nitroStatus.connected ? '● Connecting' : '● Offline'}
                        </span>
                      </div>
                      {nitroStatus.address && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider text-pewter">Wallet</span>
                          <span className="text-[10px] text-cream font-mono">
                            {nitroStatus.address.slice(0, 6)}…{nitroStatus.address.slice(-4)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-pewter">Protocol</span>
                        <span className="text-[10px] text-gold">Nitrolite / ERC-7824</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-pewter">Environment</span>
                        <span className="text-[10px] text-pewter">ClearNode Sandbox</span>
                      </div>
                      {nitroBalance && (
                        <div className="flex items-center justify-between pt-2 border-t border-gold/10">
                          <span className="text-[10px] uppercase tracking-wider text-pewter">Balance</span>
                          <span className="text-[10px] text-emerald-400 font-mono">{nitroBalance} ytest.usd</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-pewter">Loading Nitrolite status…</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Activity Feed ── */}
            <div>
              <div className="mb-6">
                <h3 className="font-[Marcellus] text-lg uppercase tracking-[0.15em] text-cream">
                  Your Activity
                </h3>
              </div>
              <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-gold/10">
                {activities.map((act) => (
                  <div key={act.id} className="relative pl-8">
                    <div className="absolute left-0 top-1 h-[22px] w-[22px] rotate-45 border border-gold/30 bg-obsidian flex items-center justify-center">
                      <Terminal size={10} className="-rotate-45 text-gold/60" />
                    </div>
                    <p className="text-[11px] text-cream uppercase tracking-wider">
                      {act.agentId === 'SYSTEM' || act.agentId === 'NITROLITE' ? (
                        <span className="text-gold">{act.agentId}</span>
                      ) : (
                        <>Agent <span className="text-gold">{act.agentId.slice(0, 8)}</span></>
                      )}
                    </p>
                    <p className="text-[10px] text-pewter mt-1">{act.action}</p>
                    <p className="text-[9px] text-gold/40 font-mono mt-1">
                      {act.taskId.slice(0, 12)}…
                    </p>
                  </div>
                ))}
                {activities.length === 0 && (
                  <p className="text-pewter text-[10px] pl-8">No activity yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
