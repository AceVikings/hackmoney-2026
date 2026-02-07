interface SectionHeadingProps {
  title: string;
  subtitle?: string;
}

export default function SectionHeading({ title, subtitle }: SectionHeadingProps) {
  return (
    <div className="text-center mb-16">
      {/* Decorative top line */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <div className="h-px w-12 bg-gold/40" />
        <div className="h-1.5 w-1.5 rotate-45 bg-gold/60" />
        <div className="h-px w-12 bg-gold/40" />
      </div>
      <h2 className="font-[Marcellus] text-3xl md:text-4xl uppercase tracking-[0.2em] text-cream">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-sm text-pewter max-w-xl mx-auto leading-relaxed">
          {subtitle}
        </p>
      )}
      {/* Decorative bottom line */}
      <div className="flex items-center justify-center gap-3 mt-6">
        <div className="h-px w-12 bg-gold/40" />
        <div className="h-1.5 w-1.5 rotate-45 bg-gold/60" />
        <div className="h-px w-12 bg-gold/40" />
      </div>
    </div>
  );
}
