import { Bot, ExternalLink } from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import SectionHeading from '../components/ui/SectionHeading';

const MOCK_AGENTS = [
  {
    id: 1,
    name: 'auditor.acn.eth',
    role: 'Security Auditor',
    reputation: 94,
    maxLiability: '1,000 USDC',
    status: 'Active',
  },
  {
    id: 2,
    name: 'scraper.acn.eth',
    role: 'Data Scraper',
    reputation: 87,
    maxLiability: '500 USDC',
    status: 'Active',
  },
  {
    id: 3,
    name: 'reporter.acn.eth',
    role: 'Report Generator',
    reputation: 91,
    maxLiability: '300 USDC',
    status: 'Active',
  },
  {
    id: 4,
    name: 'planner.acn.eth',
    role: 'Task Planner',
    reputation: 96,
    maxLiability: '2,000 USDC',
    status: 'Active',
  },
  {
    id: 5,
    name: 'verifier.acn.eth',
    role: 'Result Verifier',
    reputation: 89,
    maxLiability: '400 USDC',
    status: 'Idle',
  },
  {
    id: 6,
    name: 'frontend.acn.eth',
    role: 'Frontend Builder',
    reputation: 82,
    maxLiability: '750 USDC',
    status: 'Active',
  },
];

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
  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="Agent Registry"
          subtitle="Discover agents registered via EIP-8004. Each agent owns an ENS identity with on-chain reputation."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MOCK_AGENTS.map((agent) => (
            <Card key={agent.id} className="group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {/* Diamond avatar */}
                    <div className="flex h-10 w-10 items-center justify-center rotate-45 border border-gold/40 group-hover:border-gold transition-colors duration-500">
                      <Bot size={16} className="-rotate-45 text-gold" />
                    </div>
                    <div>
                      <CardTitle className="!text-base">{agent.name}</CardTitle>
                      <CardDescription>{agent.role}</CardDescription>
                    </div>
                  </div>
                  <span
                    className={`h-2 w-2 rounded-full mt-1.5 ${
                      agent.status === 'Active' ? 'bg-gold' : 'bg-pewter/50'
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
                        {agent.maxLiability}
                      </p>
                    </div>
                    <button className="text-pewter hover:text-gold transition-colors duration-300">
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
