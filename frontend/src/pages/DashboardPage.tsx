import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link } from 'react-router';
import { useEffect, useState } from 'react';
import {
  Activity as ActivityIcon,
  DollarSign,
  Users,
  Clock,
  Terminal,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import SectionHeading from '../components/ui/SectionHeading';
import Button from '../components/ui/Button';
import { fetchTasks, fetchActivityFeed, type Task, type Activity } from '../api/client';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isConnected && address) {
      const load = async () => {
        try {
          const [t, a] = await Promise.all([
            fetchTasks(address),
            fetchActivityFeed(),
          ]);
          setTasks(t);
          setActivities(a);
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
    { label: 'Total Committed', value: `${tasks.reduce((acc, t) => acc + t.budget, 0).toLocaleString()} USDC`, icon: DollarSign },
    { label: 'Agents Hired', value: [...new Set(tasks.flatMap(t => t.assignedAgents))].length.toString(), icon: Users },
    { label: 'Open Reversals', value: tasks.filter(t => t.status === 'reversed').length.toString(), icon: Clock },
  ];

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
                <Link to="/tasks/new">+ New Task</Link>
              </Button>
            </div>

            <div className="space-y-4">
              {loading && tasks.length === 0 ? (
                <p className="text-pewter text-sm animate-pulse">Loading tasks...</p>
              ) : tasks.length === 0 ? (
                <p className="text-pewter text-sm">No tasks found. Create one to get started.</p>
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
                            <span className="text-xs text-pewter">
                              {new Date(task.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <StatusBadge status={task.status} />
                      </div>

                      {/* Display results only if available (requester check happens server-side) */}
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

                      {task.hasResults && !task.workResults && (
                        <p className="mt-4 text-[10px] text-pewter italic">
                          Results are available but hidden (only visible to requester).
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* ── Activity Feed (Right 1/3) ── */}
          <div>
            <div className="mb-8">
              <h3 className="font-[Marcellus] text-lg uppercase tracking-[0.15em] text-cream">
                Network Activity
              </h3>
            </div>
            <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-gold/10">
              {activities.map((act) => (
                <div key={act.id} className="relative pl-8">
                  <div className="absolute left-0 top-1 h-[22px] w-[22px] rotate-45 border border-gold/30 bg-obsidian flex items-center justify-center">
                    <Terminal size={10} className="-rotate-45 text-gold/60" />
                  </div>
                  <p className="text-[11px] text-cream uppercase tracking-wider">
                    Agent <span className="text-gold">{act.agentId.slice(0, 8)}</span>
                  </p>
                  <p className="text-[10px] text-pewter mt-1">
                    {act.action === 'SUBMITTED_WORK' ? 'Submitted work proof for task' : act.action}
                  </p>
                  <p className="text-[9px] text-gold/40 font-mono mt-1">
                    {act.taskId.slice(0, 12)}...
                  </p>
                </div>
              ))}
              {activities.length === 0 && (
                <p className="text-pewter text-[10px] pl-8">No recent activity.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
