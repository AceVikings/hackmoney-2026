export default function Footer() {
  return (
    <footer className="border-t border-gold/10 bg-obsidian">
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* ── Decorative line ── */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="h-px w-16 bg-gold/30" />
          <div className="h-2 w-2 rotate-45 border border-gold/50" />
          <div className="h-px w-16 bg-gold/30" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          {/* Brand */}
          <div>
            <h3 className="font-[Marcellus] text-sm uppercase tracking-[0.25em] text-gold mb-3">
              Agent Commitment Network
            </h3>
            <p className="text-xs text-pewter leading-relaxed">
              Economic infrastructure for autonomous systems.
              Real money. Real liability. Real settlement.
            </p>
          </div>

          {/* Tech */}
          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] text-cream mb-3">
              Powered By
            </h4>
            <ul className="space-y-1.5 text-xs text-pewter">
              <li>Yellow Network (Nitrolite)</li>
              <li>Circle WaaS</li>
              <li>ENS</li>
              <li>Arc Chain</li>
            </ul>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] text-cream mb-3">
              Resources
            </h4>
            <ul className="space-y-1.5 text-xs text-pewter">
              <li>
                <a
                  href="https://github.com/AceVikings/hackmoney-2026"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-gold transition-colors duration-300"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://eips.ethereum.org/EIPS/eip-8004"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-gold transition-colors duration-300"
                >
                  EIP-8004
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-gold/10 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-pewter/60">
            Built for HackMoney 2026
          </p>
        </div>
      </div>
    </footer>
  );
}
