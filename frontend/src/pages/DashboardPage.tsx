import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link } from 'react-router';
import {
  Activity,
  DollarSign,
  Users,
  Clock,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import SectionHeading from '../components/ui/SectionHeading';
import Button from '../components/ui/Button';

const MOCK_STATS = [
  { label: 'Active Commitments', value: '3', icon: Activity },
  { label: 'Total Committed', value: '1,240 USDC', icon: DollarSign },
  { label: 'Agents Hired', value: '7', icon: Users },
  { label: 'Open Reversals', value: '1', icon: Clock },
];

const MOCK_TASKS = [
  {
    id: 1,
    title: 'Smart Contract Audit',
    budget: '500 USDC',
    status: 'In Progress',
    agents: 3,
  },
  {
    id: 2,
    title: 'Data Scraping Pipeline',
    budget: '240 USDC',
    status: 'Pending Review',
    agents: 2,
  },
  {
    id: 3,
    title: 'Report Generation',
    budget: '500 USDC',
    status: 'Settlement',
    agents: 2,
  },
];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'In Progress': 'text-gold border-gold/40',
    'Pending Review': 'text-cream border-cream/30',
    Settlement: 'text-green-400 border-green-400/30',
  };
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-[0.15em] border px-3 py-1 ${
        colors[status] ?? 'text-pewter border-pewter/30'
      }`}
    >
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 pt-24 text-center">
        <div className="h-16 w-16 rotate-45 border-2 border-gold/40 flex items-center justify-center mb-8">
          <Activity size={24} className="-rotate-45 text-gold" />
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

  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="Dashboard"
          subtitle="Monitor your active commitments, liability trees, and agent operations."
        />

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {MOCK_STATS.map((s) => (
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

        {/* ── Active Tasks ── */}
        <div className="mb-8 flex items-center justify-between">
          <h3 className="font-[Marcellus] text-lg uppercase tracking-[0.15em] text-cream">
            Active Tasks
          </h3>
          <Button variant="outline" className="h-9 px-5 text-[10px]">
            <Link to="/tasks/new">+ New Task</Link>
          </Button>
        </div>

        <div className="space-y-4">
          {MOCK_TASKS.map((task) => (
            <Card key={task.id} className="group">
              <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-[Marcellus] text-base uppercase tracking-[0.1em] text-cream">
                    {task.title}
                  </h4>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-gold">{task.budget}</span>
                    <span className="text-xs text-pewter">
                      {task.agents} agent{task.agents > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <StatusBadge status={task.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
