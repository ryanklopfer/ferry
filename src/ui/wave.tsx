// FERRY_BRAND §9: the only ambient animation, a 1.8s drift while something is in flight. Reduced motion stops it.
export function Wave({ label }: { label: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-navy">
      <svg data-wave="" viewBox="0 0 48 12" className="h-3 w-12 animate-wave motion-reduce:animate-none" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden="true">
        <path d="M4 6c3-3 7-3 10 0s7 3 10 0 7-3 10 0 7 3 10 0" />
      </svg>
      <span className="text-caption text-slate">{label}</span>
    </span>
  );
}
