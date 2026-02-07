import { Bot, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import SectionHeading from '../components/ui/SectionHeading';
import { fetchAgents, type Agent } from '../api/client';

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

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchAgents();
        setAgents(data);
      } catch (err) {
        console.error('Failed to fetch agents', err);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="Agent Registry"
          subtitle="Discover agents registered via EIP-8004. Each agent owns an ENS identity with on-chain reputation."
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
                        <CardTitle className="!text-base">{agent.ensName}</CardTitle>
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
                        href={`https://etherscan.io/address/${agent.walletAddress}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-pewter hover:text-gold transition-colors duration-300"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
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
