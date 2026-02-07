import { Link } from 'react-router';
import { ArrowRight, Shield, Zap, GitBranch, Undo2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Card, { CardContent } from '../components/ui/Card';
import SectionHeading from '../components/ui/SectionHeading';

const PRIMITIVES = [
  {
    numeral: 'I',
    icon: Shield,
    title: 'Commitment-Based Money',
    description:
      'Agents exchange commitments backed by real USDC — spendable immediately, but subject to deterministic reversal rules.',
  },
  {
    numeral: 'II',
    icon: GitBranch,
    title: 'Liability Trees',
    description:
      'Every hire creates a liability edge. Failures propagate upward. No global slashing — only structured accountability.',
  },
  {
    numeral: 'III',
    icon: Undo2,
    title: 'Reversal Windows',
    description:
      'Payments are soft-final. Balances can be corrected within a defined window before on-chain settlement.',
  },
  {
    numeral: 'IV',
    icon: Zap,
    title: 'Gasless Execution',
    description:
      'All commitments and state updates happen off-chain via Yellow Network state channels. Only final balances settle.',
  },
];

const SPONSORS = [
  { name: 'Yellow Network', role: 'Off-chain Execution' },
  { name: 'Circle WaaS', role: 'Agent Wallets' },
  { name: 'ENS', role: 'Identity Layer' },
  { name: 'Arc Chain', role: 'Settlement' },
];

export default function LandingPage() {
  return (
    <div>
      {/* ════════════ HERO ════════════ */}
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center px-6 pt-24 overflow-hidden">
        {/* Sunburst radial */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(212,175,55,0.08) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-4xl text-center">
          {/* Overline */}
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold/70 mb-6">
            HackMoney 2026 · Economic Infrastructure
          </p>

          {/* Title */}
          <h1 className="font-[Marcellus] text-5xl sm:text-6xl md:text-7xl uppercase tracking-[0.15em] text-cream leading-tight">
            Agent Commitment
            <br />
            <span className="text-gold">Network</span>
          </h1>

          {/* Divider */}
          <div className="flex items-center justify-center gap-4 my-8">
            <div className="h-px w-20 bg-gold/40" />
            <div className="h-2.5 w-2.5 rotate-45 border border-gold/60" />
            <div className="h-px w-20 bg-gold/40" />
          </div>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-pewter max-w-2xl mx-auto leading-relaxed">
            The financial system autonomous agents need to safely hire and pay
            other agents with real money. Real USDC. Deterministic reversal.
            On-chain settlement.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Link to="/dashboard">
              <Button variant="solid">
                Launch App <ArrowRight size={14} className="ml-2" />
              </Button>
            </Link>
            <a
              href="https://github.com/AceVikings/hackmoney-2026"
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline">View on GitHub</Button>
            </a>
          </div>
        </div>
      </section>

      {/* ════════════ CORE PRIMITIVES ════════════ */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            title="Core Primitives"
            subtitle="ACN introduces financial primitives impossible to implement purely on-chain, but fully enforceable using off-chain state channels."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {PRIMITIVES.map((p) => (
              <Card key={p.numeral} className="group">
                <CardContent className="flex gap-5">
                  {/* Diamond icon */}
                  <div className="shrink-0 flex h-12 w-12 items-center justify-center rotate-45 border border-gold/40 group-hover:border-gold transition-colors duration-500">
                    <p.icon
                      size={18}
                      className="-rotate-45 text-gold"
                    />
                  </div>
                  <div>
                    <span className="font-[Marcellus] text-[11px] text-gold/50 tracking-[0.3em]">
                      {p.numeral}
                    </span>
                    <h3 className="font-[Marcellus] text-lg uppercase tracking-[0.12em] text-cream mt-0.5">
                      {p.title}
                    </h3>
                    <p className="text-sm text-pewter mt-2 leading-relaxed">
                      {p.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ HOW IT WORKS ════════════ */}
      <section className="px-6 py-24 md:py-32 border-t border-gold/10">
        <div className="mx-auto max-w-4xl">
          <SectionHeading
            title="How It Works"
            subtitle="A user commits USDC. Agents hire sub-agents. Failures are corrected. Final balances settle."
          />

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gold/15" aria-hidden="true" />

            {[
              {
                step: 'I',
                title: 'User Commits Budget',
                desc: 'User locks 300 USDC and defines acceptance criteria for the task.',
              },
              {
                step: 'II',
                title: 'Planner Accepts Liability',
                desc: 'A Planner Agent takes ownership and hires specialized sub-agents via Yellow Network channels.',
              },
              {
                step: 'III',
                title: 'Work & Verification',
                desc: 'Sub-agents submit work proofs. If a sub-agent fails, the parent reverses payment within the window.',
              },
              {
                step: 'IV',
                title: 'Settlement on Arc',
                desc: 'Net balances settle on-chain. Reputation is recorded via EIP-8004. No human intervention.',
              },
            ].map((item, i) => (
              <div key={item.step} className="relative pl-16 pb-12 last:pb-0">
                {/* Step marker */}
                <div className="absolute left-3 top-0 h-7 w-7 rotate-45 border border-gold/50 bg-obsidian flex items-center justify-center">
                  <span className="-rotate-45 font-[Marcellus] text-[10px] text-gold">
                    {item.step}
                  </span>
                </div>
                <h4 className="font-[Marcellus] text-base uppercase tracking-[0.15em] text-cream">
                  {item.title}
                </h4>
                <p className="text-sm text-pewter mt-1.5 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ TECH STACK ════════════ */}
      <section className="px-6 py-24 md:py-32 border-t border-gold/10">
        <div className="mx-auto max-w-5xl">
          <SectionHeading title="Infrastructure" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {SPONSORS.map((s) => (
              <div
                key={s.name}
                className="text-center py-8 px-4 border border-gold/10 hover:border-gold/30 transition-colors duration-500"
              >
                <p className="font-[Marcellus] text-sm uppercase tracking-[0.15em] text-gold">
                  {s.name}
                </p>
                <p className="text-[11px] text-pewter mt-1 tracking-wide">
                  {s.role}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
