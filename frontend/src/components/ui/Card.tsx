import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export default function Card({ children, className = '', hover = true }: CardProps) {
  return (
    <div
      className={`
        relative bg-charcoal border border-gold/20
        transition-all duration-500
        ${hover ? 'hover:-translate-y-1 hover:border-gold/60 hover:shadow-[0_0_20px_rgba(212,175,55,0.1)]' : ''}
        ${className}
      `}
    >
      {/* Corner decorations */}
      <div className="absolute top-2 left-2 h-4 w-4 border-t border-l border-gold/30 pointer-events-none transition-opacity duration-500 opacity-50 group-hover:opacity-100" aria-hidden="true" />
      <div className="absolute bottom-2 right-2 h-4 w-4 border-b border-r border-gold/30 pointer-events-none transition-opacity duration-500 opacity-50 group-hover:opacity-100" aria-hidden="true" />
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`p-6 border-b border-gold/10 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={`font-[Marcellus] text-xl uppercase tracking-[0.15em] text-gold ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-sm text-pewter mt-1 ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
}
