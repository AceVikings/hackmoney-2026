import { Bot, ExternalLink, ShieldCheck, BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import SectionHeading from '../components/ui/SectionHeading';
import { fetchAgents, fetchENSRecords, type Agent } from '../api/client';

const ARC_EXPLORER = 'https://testnet.arcscan.app';
const SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io';

function ReputationBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1 bg-obsidian overflow-hidden">
        <div
          className="h-full bg-gold/70 transition-all duration-700"
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-gold font-medium tabular-nums w-8 text-right">
        {score}
      </span>
    </div>
  );
}

function ENSBadge({ agent, records }: { agent: Agent; records: Record<string, string> | null }) {
  if (!agent.subnameRegistered) return null;

  return (
    <div className="mt-3 p-2.5 border border-gold/10 bg-gold/[0.02] space-y-2">
      {/* ENS name + verified badge */}
      <div className="flex items-center gap-1.5">
        <ShieldCheck size={12} className="text-gold/70" />
        <span className="text-[10px] uppercase tracking-[0.15em] text-gold/70">
          On-chain Identity
        </span>
      </div>

      {/* Text records from chain */}
      {records && (
        <div className="space-y-1">
          {records['acn.role'] && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-pewter/60 w-16">role</span>
              <span className="text-[11px] text-cream/80">{records['acn.role']}</span>
            </div>
          )}
          {records['acn.skills'] && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-pewter/60 w-16">skills</span>
              <span className="text-[11px] text-cream/80">{records['acn.skills']}</span>
            </div>
          )}
          {records['acn.reputation'] && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-pewter/60 w-16">rep</span>
              <span className="text-[11px] text-gold font-medium">{records['acn.reputation']}/100</span>
            </div>
          )}
          {(records['acn.tasksCompleted'] || records['acn.tasksFailed']) && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-pewter/60 w-16">tasks</span>
              <span className="text-[11px] text-cream/80">
                {records['acn.tasksCompleted'] || '0'}✓ {records['acn.tasksFailed'] || '0'}✗
              </span>
            </div>
          )}
        </div>
      )}

      {/* Explorer links */}
      <div className="flex items-center gap-3 pt-1 border-t border-gold/5">
        {agent.subnameTxHash && (
          <a
            href={`${SEPOLIA_EXPLORER}/tx/${agent.subnameTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[9px] text-pewter/50 hover:text-gold transition-colors"
          >
            <BookOpen size={9} />
            registration tx
          </a>
        )}
        {agent.subnameNode && (
          <span className="text-[9px] text-pewter/30 font-mono truncate" title={agent.subnameNode}>
            {agent.subnameNode.slice(0, 10)}…
          </span>
        )}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [ensRecords, setEnsRecords] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchAgents();
        setAgents(data);

        // Fetch ENS text records for registered agents
        const recordPromises = data
          .filter((a) => a.subnameRegistered)
          .map(async (a) => {
            try {
              const res = await fetchENSRecords(a.ensName);
              return { ensName: a.ensName, records: res.records };
            } catch {
              return null;
            }
          });

        const results = await Promise.all(recordPromises);
        const recordsMap: Record<string, Record<string, string>> = {};
        for (const r of results) {
          if (r) recordsMap[r.ensName] = r.records;
        }
        setEnsRecords(recordsMap);
      } catch (err) {
        console.error('Failed to fetch agents', err);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="Agent Registry"
          subtitle="Discover agents registered via EIP-8004. Each agent owns an ENS subname with on-chain reputation stored as text records."
        />

        {loading && agents.length === 0 ? (
          <p className="text-center text-pewter animate-pulse">Scanning registry...</p>
        ) : agents.length === 0 ? (
          <p className="text-center text-pewter">No agents registered yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <Card key={agent.id} className="group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Diamond avatar */}
                      <div className="flex h-10 w-10 items-center justify-center rotate-45 border border-gold/40 group-hover:border-gold transition-colors duration-500">
                        <Bot size={16} className="-rotate-45 text-gold" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <CardTitle className="!text-base">{agent.ensName}</CardTitle>
                          {agent.subnameRegistered && (
                            <span title="ENS subname verified on-chain"><ShieldCheck size={13} className="text-gold/60" /></span>
                          )}
                        </div>
                        <CardDescription>{agent.role}</CardDescription>
                      </div>
                    </div>
                    <span
                      className={`h-2 w-2 rounded-full mt-1.5 ${
                        agent.active ? 'bg-gold' : 'bg-pewter/50'
                      }`}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-pewter mb-1.5">
                        Reputation
                      </p>
                      <ReputationBar score={agent.reputation} />
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-pewter">
                          Max Liability
                        </p>
                        <p className="text-sm text-cream mt-0.5">
                          {agent.maxLiability} USDC
                        </p>
                      </div>
                      <a 
                        href={`${ARC_EXPLORER}/address/${agent.walletAddress}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-pewter hover:text-gold transition-colors duration-300"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>

                    {/* ENS on-chain identity badge */}
                    <ENSBadge
                      agent={agent}
                      records={ensRecords[agent.ensName] ?? null}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
