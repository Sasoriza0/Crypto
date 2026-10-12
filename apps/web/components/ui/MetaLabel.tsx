/**
 * Small mono uppercase label used across the dossier chrome
 * (v0: MetaLabel — 10px, bold, 0.28em tracking, faded ink).
 */
export function MetaLabel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-fade ${className}`}>
      {children}
    </p>
  );
}
