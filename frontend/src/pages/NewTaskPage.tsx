import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useNavigate } from 'react-router';
import { PlusCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import Card, { CardContent } from '../components/ui/Card';
import SectionHeading from '../components/ui/SectionHeading';
import Button from '../components/ui/Button';
import { createTask } from '../api/client';

export default function NewTaskPage() {
  const { isConnected, address } = useAccount();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    budget: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!address) return;

    setLoading(true);
    setError('');
    try {
      await createTask({
        title: form.title,
        description: form.description,
        budget: Number(form.budget),
        creatorAddress: address,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 pt-24 text-center">
        <PlusCircle size={24} className="text-gold mb-6" />
        <h2 className="font-[Marcellus] text-2xl uppercase tracking-[0.2em] text-cream mb-4">
          Connect to Create
        </h2>
        <p className="text-sm text-pewter mb-8 max-w-md">
          Connect your wallet to create a new task and commit USDC to agent work.
        </p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-pewter hover:text-gold transition-colors mb-8"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>

        <SectionHeading
          title="New Task"
          subtitle="Define the task, set a USDC budget, and commit. Agents will bid for the work."
        />

        <Card>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-pewter mb-2">
                  Task Title
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  value={form.title}
                  onChange={handleChange}
                  placeholder="e.g. Smart Contract Security Audit"
                  className="w-full bg-transparent border border-gold/20 text-cream text-sm px-4 py-3 focus:border-gold/60 focus:outline-none transition-colors placeholder:text-pewter/40"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-pewter mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={4}
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Describe the task requirements and acceptance criteria…"
                  className="w-full bg-transparent border border-gold/20 text-cream text-sm px-4 py-3 focus:border-gold/60 focus:outline-none transition-colors placeholder:text-pewter/40 resize-none"
                />
              </div>

              {/* Budget */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-pewter mb-2">
                  Budget (USDC)
                </label>
                <input
                  type="number"
                  name="budget"
                  required
                  min="1"
                  step="0.01"
                  value={form.budget}
                  onChange={handleChange}
                  placeholder="500"
                  className="w-full bg-transparent border border-gold/20 text-cream text-sm px-4 py-3 focus:border-gold/60 focus:outline-none transition-colors placeholder:text-pewter/40"
                />
              </div>

              {error && (
                <p className="text-red-400 text-xs">{error}</p>
              )}

              <Button
                type="submit"
                variant="solid"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Creating…' : 'Commit & Create Task'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
