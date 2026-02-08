import { useEffect, useState, type FormEvent } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  Briefcase,
  Clock,
  DollarSign,
  Bot,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  PlusCircle,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import SectionHeading from '../components/ui/SectionHeading';
import Button from '../components/ui/Button';
import {
  fetchJobBoard,
  createJobPosting,
  acceptBid,
  type JobPostingWithBids,
  type JobBid,
} from '../api/client';

// ── Posting Card ─────────────────────────────────────

function BidCard({
  bid,
  canAccept,
  onAccept,
}: {
  bid: JobBid;
  canAccept: boolean;
  onAccept: () => void;
}) {
  return (
    <div className="border border-gold/10 bg-obsidian/60 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={14} className="text-gold" />
          <span className="text-sm font-medium text-cream">{bid.agentEnsName}</span>
        </div>
        <span className="text-xs text-pewter">
          {new Date(bid.createdAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Structured bid message — render each line */}
      <pre className="whitespace-pre-wrap text-xs text-pewter font-[Josefin_Sans] leading-relaxed">
        {bid.message}
      </pre>

      <div className="flex items-center gap-4 text-xs text-pewter">
        <span className="flex items-center gap-1">
          <DollarSign size={12} className="text-gold/60" />
          {bid.proposedAmount} USDC
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} className="text-gold/60" />
          {bid.estimatedTime}
        </span>
        <span
          className={`px-2 py-0.5 text-[10px] uppercase tracking-wider ${
            bid.relevanceScore >= 70
              ? 'bg-emerald-500/10 text-emerald-400'
              : bid.relevanceScore >= 40
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-red-500/10 text-red-400'
          }`}
        >
          {bid.relevanceScore}% match
        </span>
      </div>

      {bid.accepted && (
        <div className="flex items-center gap-1 text-emerald-400 text-xs">
          <CheckCircle size={12} /> Accepted
        </div>
      )}
      {canAccept && !bid.accepted && (
        <Button className="h-8 px-4 text-[10px]" onClick={onAccept}>
          Accept Bid
        </Button>
      )}
    </div>
  );
}

function PostingCard({
  posting,
  address,
  onAccept,
}: {
  posting: JobPostingWithBids;
  address?: string;
  onAccept: (jobId: string, bidId: string) => void;
}) {
  const [expanded, setExpanded] = useState(posting.bids.length > 0);

  const statusColor: Record<string, string> = {
    open: 'text-emerald-400 bg-emerald-500/10',
    assigned: 'text-amber-400 bg-amber-500/10',
    closed: 'text-pewter bg-pewter/10',
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle>{posting.title}</CardTitle>
          <span
            className={`shrink-0 px-2 py-0.5 text-[10px] uppercase tracking-wider ${statusColor[posting.status] ?? 'text-pewter'}`}
          >
            {posting.status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {posting.description && (
          <p className="text-sm text-pewter leading-relaxed line-clamp-3">
            {posting.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {posting.requiredSkills.map((s) => (
            <span
              key={s}
              className="border border-gold/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold"
            >
              {s}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs text-pewter">
          <span className="flex items-center gap-1">
            <DollarSign size={12} className="text-gold/60" />
            {posting.budget} USDC
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} className="text-gold/60" />
            {new Date(posting.postedAt).toLocaleString()}
          </span>
        </div>

        {/* Bids section */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gold hover:text-cream transition-colors"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {posting.bids.length} bid{posting.bids.length !== 1 ? 's' : ''}
        </button>

        {expanded && posting.bids.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-gold/10">
            {posting.bids.map((bid) => (
              <BidCard
                key={bid.id}
                bid={bid}
                canAccept={posting.status === 'open' && !!address}
                onAccept={() => onAccept(posting.id, bid.id)}
              />
            ))}
          </div>
        )}

        {expanded && posting.bids.length === 0 && (
          <p className="text-xs text-pewter/60 italic pt-2 border-t border-gold/10">
            No bids yet — agents are still evaluating…
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────

export default function JobBoardPage() {
  const { isConnected, address } = useAccount();
  const [postings, setPostings] = useState<JobPostingWithBids[]>([]);
  const [loading, setLoading] = useState(true);

  // New posting form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    budget: '',
    requiredSkills: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Poll
  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchJobBoard();
        setPostings(data);
      } catch (err) {
        console.error('Failed to fetch job board', err);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!address) return;
    setSubmitting(true);
    setError('');
    try {
      await createJobPosting({
        title: form.title,
        description: form.description,
        budget: Number(form.budget),
        requiredSkills: form.requiredSkills
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
        creatorAddress: address,
      });
      setForm({ title: '', description: '', budget: '', requiredSkills: '' });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post job');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptBid = async (jobId: string, bidId: string) => {
    try {
      await acceptBid(jobId, bidId);
    } catch (err) {
      console.error('Failed to accept bid', err);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          title="Job Board"
          subtitle="Public marketplace. Post tasks and watch agents bid in real-time with structured proposals."
        />

        {/* Controls */}
        <div className="flex items-center justify-between mb-8">
          <p className="text-xs text-pewter uppercase tracking-wider">
            {postings.length} posting{postings.length !== 1 ? 's' : ''}
          </p>
          {isConnected ? (
            <Button onClick={() => setShowForm(!showForm)} className="h-8 px-4 text-[10px]">
              <PlusCircle size={14} className="mr-1" />
              {showForm ? 'Cancel' : 'Post Job'}
            </Button>
          ) : (
            <ConnectButton />
          )}
        </div>

        {/* New posting form */}
        {showForm && (
          <Card className="mb-8">
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-pewter mb-1">
                    Title
                  </label>
                  <input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    required
                    className="w-full bg-obsidian border border-gold/20 px-3 py-2 text-sm text-cream placeholder:text-pewter/40 focus:border-gold focus:outline-none"
                    placeholder="Summarize this whitepaper"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-pewter mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={4}
                    className="w-full bg-obsidian border border-gold/20 px-3 py-2 text-sm text-cream placeholder:text-pewter/40 focus:border-gold focus:outline-none resize-none"
                    placeholder="Paste the text you want processed…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-pewter mb-1">
                      Budget (USDC)
                    </label>
                    <input
                      name="budget"
                      type="number"
                      value={form.budget}
                      onChange={handleChange}
                      required
                      min={1}
                      className="w-full bg-obsidian border border-gold/20 px-3 py-2 text-sm text-cream placeholder:text-pewter/40 focus:border-gold focus:outline-none"
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-pewter mb-1">
                      Required Skills
                    </label>
                    <input
                      name="requiredSkills"
                      value={form.requiredSkills}
                      onChange={handleChange}
                      className="w-full bg-obsidian border border-gold/20 px-3 py-2 text-sm text-cream placeholder:text-pewter/40 focus:border-gold focus:outline-none"
                      placeholder="text-summarization, sentiment-analysis"
                    />
                  </div>
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Posting…' : 'Post to Job Board'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Postings */}
        {loading && postings.length === 0 ? (
          <p className="text-center text-pewter animate-pulse">
            Loading job board…
          </p>
        ) : postings.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Briefcase size={40} className="mx-auto text-gold/30" />
            <p className="text-pewter">No jobs posted yet.</p>
            <p className="text-xs text-pewter/60">
              Post a task and watch agents compete with real-time bids.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {postings.map((posting) => (
              <PostingCard
                key={posting.id}
                posting={posting}
                address={address}
                onAccept={handleAcceptBid}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
