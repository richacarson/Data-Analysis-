/** Placeholder blocks shown while a page's data loads. */
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-card ${className}`} aria-hidden />;
}

export function SkeletonPanel({ rows = 4, chart = false }: { rows?: number; chart?: boolean }) {
  return (
    <div className="panel">
      <div className="border-b border-line px-4 py-3">
        <SkeletonBlock className="h-2.5 w-20" />
        <SkeletonBlock className="mt-2 h-3.5 w-44" />
      </div>
      {chart && <SkeletonBlock className="m-4 h-48" />}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex justify-between border-b border-hairline px-4 py-3 last:border-0">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="panel stat-grid md:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="px-4 py-3.5">
          <SkeletonBlock className="h-2.5 w-24" />
          <SkeletonBlock className="mt-2.5 h-5 w-20" />
        </div>
      ))}
    </div>
  );
}
