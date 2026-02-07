import type { ReactNode, ButtonHTMLAttributes } from 'react';

type Variant = 'default' | 'solid' | 'outline';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const base =
  'inline-flex items-center justify-center h-12 px-8 text-xs uppercase tracking-[0.2em] font-medium transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-obsidian disabled:opacity-40 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  default:
    'border-2 border-gold text-gold bg-transparent hover:bg-gold hover:text-obsidian hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]',
  solid:
    'bg-gold text-obsidian border-2 border-gold hover:bg-gold-light hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]',
  outline:
    'border border-gold/40 text-cream bg-transparent hover:bg-midnight hover:border-gold/60',
};

export default function Button({ variant = 'default', className = '', children, ...props }: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
