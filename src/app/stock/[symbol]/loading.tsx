import { SkeletonBlock, SkeletonPanel, SkeletonStats } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading valuation">
      <div className="panel px-4 py-4 sm:px-5">
        <SkeletonBlock className="h-2.5 w-24" />
        <SkeletonBlock className="mt-2.5 h-6 w-64 max-w-full" />
        <SkeletonBlock className="mt-2 h-3 w-48" />
      </div>
      <SkeletonStats count={4} />
      <SkeletonPanel rows={5} chart />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonPanel rows={4} />
        <SkeletonPanel rows={4} />
      </div>
    </div>
  );
}
