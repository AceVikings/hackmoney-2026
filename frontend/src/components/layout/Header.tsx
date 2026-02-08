import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link, useLocation } from 'react-router';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/jobs', label: 'Job Board' },
  { to: '/agents', label: 'Agents' },
];

export default function Header() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-gold/20 bg-obsidian/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* ── Logo ── */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative flex h-9 w-9 items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <img src="/acn-logo.svg" alt="ACN Logo" className="h-full w-full" />
          </div>
          <span className="font-[Marcellus] text-lg tracking-[0.25em] text-cream uppercase hidden sm:block">
            ACN
          </span>
        </Link>

        {/* ── Desktop Nav ── */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map(({ to, label }) => {
            const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`text-xs uppercase tracking-[0.2em] transition-colors duration-300 ${
                  active
                    ? 'text-gold'
                    : 'text-pewter hover:text-cream'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* ── Wallet ── */}
        <div className="flex items-center gap-4">
          <ConnectButton
            accountStatus="address"
            chainStatus="icon"
            showBalance={false}
          />

          {/* Mobile toggle */}
          <button
            className="md:hidden text-cream"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ── Mobile Nav ── */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-gold/10 bg-obsidian/95 px-6 py-4 space-y-3">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className="block text-xs uppercase tracking-[0.2em] text-pewter hover:text-gold transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
