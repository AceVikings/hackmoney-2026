import { useEffect, useState, type FormEvent } from 'react';
import { useAccount, useWriteContract, useSwitchChain, useChainId } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { parseEther } from 'viem';
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
  Shield,
  Hash,
  ExternalLink,
  Wallet,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import SectionHeading from '../components/ui/SectionHeading';
import Button from '../components/ui/Button';
import { config } from '../config/wagmi';
import {
  ESCROW_CONTRACT_ADDRESS,
  ESCROW_ABI,
  ARC_CHAIN_ID,
  taskIdToBytes32,
} from '../config/contracts';
import {
  fetchJobBoard,
  createJobPosting,
  confirmEscrow,
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

// ── Step Indicator (escrow deposit progress) ─────────

function StepIndicator({
  done,
  active,
  label,
}: {
  done: boolean;
  active: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <CheckCircle size={14} className="text-emerald-400 shrink-0" />
      ) : active ? (
        <div className="h-3.5 w-3.5 border-2 border-gold rounded-full animate-spin border-t-transparent shrink-0" />
      ) : (
        <div className="h-3.5 w-3.5 border border-pewter/30 rounded-full shrink-0" />
      )}
      <span
        className={`text-xs ${done ? 'text-emerald-400' : active ? 'text-cream' : 'text-pewter/40'}`}
      >
        {label}
      </span>
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

  // Only the original poster can accept bids
  const isCreator =
    !!address &&
    !!posting.creatorAddress &&
    address.toLowerCase() === posting.creatorAddress.toLowerCase();

  const statusColor: Record<string, string> = {
    open: 'text-emerald-400 bg-emerald-500/10',
    assigned: 'text-amber-400 bg-amber-500/10',
    closed: 'text-pewter bg-pewter/10',
  };

  const escrowColor: Record<string, string> = {
    none: 'text-pewter',
    pending_escrow: 'text-yellow-500',
    held: 'text-amber-400',
    released: 'text-emerald-400',
    refunded: 'text-red-400',
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle>{posting.title}</CardTitle>
          <div className="flex items-center gap-2">
            {posting.escrowStatus && posting.escrowStatus !== 'none' && (
              <span
                className={`shrink-0 flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider ${escrowColor[posting.escrowStatus] ?? 'text-pewter'}`}
              >
                <Shield size={10} />
                {posting.escrowStatus === 'pending_escrow' ? 'awaiting deposit' : posting.escrowStatus}
              </span>
            )}
            <span
              className={`shrink-0 px-2 py-0.5 text-[10px] uppercase tracking-wider ${statusColor[posting.status] ?? 'text-pewter'}`}
            >
              {posting.status}
            </span>
          </div>
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
          {posting.escrowAmount != null && posting.escrowAmount > 0 && (
            <span className="flex items-center gap-1">
              <Shield size={12} className="text-gold/60" />
              {posting.escrowAmount} escrowed
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={12} className="text-gold/60" />
            {new Date(posting.postedAt).toLocaleString()}
          </span>
        </div>

        {/* Creator badge */}
        {isCreator && (
          <p className="text-[10px] text-gold/60 uppercase tracking-wider">
            ▸ Your posting
          </p>
        )}

        {/* Escrow tx hash */}
        {posting.escrowTxHash && (
          <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/20 px-3 py-2 text-xs">
            <Shield size={12} className="text-amber-400 shrink-0" />
            <span className="text-[10px] text-pewter uppercase tracking-wider mr-2">Escrow</span>
            {posting.escrowTxHash.startsWith('0x') ? (
              <a
                href={`https://testnet.arcscan.app/tx/${posting.escrowTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 font-mono truncate hover:text-amber-300 transition-colors flex items-center gap-1"
              >
                {posting.escrowTxHash.slice(0, 10)}…{posting.escrowTxHash.slice(-8)}
                <ExternalLink size={10} className="shrink-0" />
              </a>
            ) : (
              <span className="text-amber-400 font-mono truncate">{posting.escrowTxHash}</span>
            )}
          </div>
        )}

        {/* Settlement hash */}
        {posting.settlementHash && (
          <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 px-3 py-2 text-xs">
            <Hash size={12} className="text-emerald-400 shrink-0" />
            <span className="text-[10px] text-pewter uppercase tracking-wider mr-2">Settlement</span>
            {posting.settlementHash.startsWith('0x') ? (
              <a
                href={`https://testnet.arcscan.app/tx/${posting.settlementHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 font-mono truncate hover:text-emerald-300 transition-colors flex items-center gap-1"
              >
                {posting.settlementHash.slice(0, 10)}…{posting.settlementHash.slice(-8)}
                <ExternalLink size={10} className="shrink-0" />
              </a>
            ) : (
              <span className="text-emerald-400 font-mono truncate">{posting.settlementHash}</span>
            )}
          </div>
        )}

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
                canAccept={posting.status === 'open' && isCreator}
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

type EscrowStep =
  | 'idle'
  | 'creating'
  | 'switching-chain'
  | 'awaiting-signature'
  | 'confirming-tx'
  | 'confirming-backend'
  | 'done';

export default function JobBoardPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

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
  const [escrowStep, setEscrowStep] = useState<EscrowStep>('idle');
  const [escrowTxHash, setEscrowTxHash] = useState<string | null>(null);

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
    setEscrowStep('creating');
    setEscrowTxHash(null);

    try {
      // Step 1: Create job posting on backend (escrow pending)
      const job = await createJobPosting({
        title: form.title,
        description: form.description,
        budget: Number(form.budget),
        requiredSkills: form.requiredSkills
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
        creatorAddress: address,
      });

      // Step 2: Switch to Arc Testnet if needed
      if (chainId !== ARC_CHAIN_ID) {
        setEscrowStep('switching-chain');
        await switchChainAsync({ chainId: ARC_CHAIN_ID });
      }

      // Step 3: Deposit escrow on-chain via user's wallet
      setEscrowStep('awaiting-signature');
      const bytes32TaskId = taskIdToBytes32(job.taskId);
      const hash = await writeContractAsync({
        address: ESCROW_CONTRACT_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'deposit',
        args: [bytes32TaskId],
        value: parseEther(String(form.budget)),
        chainId: ARC_CHAIN_ID,
      });
      setEscrowTxHash(hash);

      // Step 4: Wait for on-chain confirmation
      setEscrowStep('confirming-tx');
      await waitForTransactionReceipt(config, { hash, chainId: ARC_CHAIN_ID });

      // Step 5: Confirm with backend (verifies deposit on-chain)
      setEscrowStep('confirming-backend');
      await confirmEscrow(job.id, hash, address);

      // Done!
      setEscrowStep('done');
      setTimeout(() => {
        setForm({ title: '', description: '', budget: '', requiredSkills: '' });
        setShowForm(false);
        setEscrowStep('idle');
        setEscrowTxHash(null);
        setSubmitting(false);
      }, 4000);
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Failed to post job';
      setError(
        msg.includes('User rejected') || msg.includes('denied')
          ? 'Transaction rejected — escrow deposit cancelled'
          : msg,
      );
      setEscrowStep('idle');
      setSubmitting(false);
    }
  };

  const handleAcceptBid = async (jobId: string, bidId: string) => {
    if (!address) return;
    try {
      await acceptBid(jobId, bidId, address);
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
                      min={0.01}
                      step={0.01}
                      className="w-full bg-obsidian border border-gold/20 px-3 py-2 text-sm text-cream placeholder:text-pewter/40 focus:border-gold focus:outline-none"
                      placeholder="0.50"
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

                {/* Escrow deposit progress stepper */}
                {escrowStep !== 'idle' && (
                  <div className="space-y-2.5 border border-gold/20 bg-obsidian/80 p-4">
                    <p className="text-[10px] uppercase tracking-wider text-gold mb-3 flex items-center gap-1.5">
                      <Wallet size={12} />
                      Escrow Deposit Progress
                    </p>
                    <StepIndicator
                      done={['switching-chain', 'awaiting-signature', 'confirming-tx', 'confirming-backend', 'done'].includes(escrowStep)}
                      active={escrowStep === 'creating'}
                      label="Creating job posting…"
                    />
                    <StepIndicator
                      done={['awaiting-signature', 'confirming-tx', 'confirming-backend', 'done'].includes(escrowStep)}
                      active={escrowStep === 'switching-chain'}
                      label="Switching to Arc Testnet…"
                    />
                    <StepIndicator
                      done={['confirming-tx', 'confirming-backend', 'done'].includes(escrowStep)}
                      active={escrowStep === 'awaiting-signature'}
                      label={`Deposit ${form.budget || '—'} USDC → ACNEscrow contract`}
                    />
                    <StepIndicator
                      done={['confirming-backend', 'done'].includes(escrowStep)}
                      active={escrowStep === 'confirming-tx'}
                      label="Confirming on Arc Testnet…"
                    />
                    <StepIndicator
                      done={escrowStep === 'done'}
                      active={escrowStep === 'confirming-backend'}
                      label="Verifying deposit on-chain…"
                    />
                    {escrowTxHash && (
                      <a
                        href={`https://testnet.arcscan.app/tx/${escrowTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-gold hover:text-cream transition-colors pt-2"
                      >
                        <ExternalLink size={12} />
                        View escrow transaction on ArcScan
                      </a>
                    )}
                    {escrowStep === 'done' && (
                      <p className="text-emerald-400 text-sm font-medium pt-1">
                        ✓ Escrow deposited — job is now live on the board!
                      </p>
                    )}
                  </div>
                )}

                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? escrowStep === 'done'
                      ? '✓ Posted!'
                      : 'Processing…'
                    : `Post Job & Deposit ${form.budget || '0'} USDC Escrow`}
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
