import { SkeletonBlock, SkeletonPanel, SkeletonStats } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Running screen">
      <div className="panel px-4 py-4 sm:px-5">
        <SkeletonBlock className="h-2.5 w-28" />
        <SkeletonBlock className="mt-2.5 h-6 w-40" />
        <p className="mt-3 text-[12px] text-t4">
          Scoring every holding against consensus. The first run after a while takes a couple of minutes, paced to stay inside the data provider’s rate limit; after that it is quick.
        </p>
      </div>
      <SkeletonStats count={4} />
      <SkeletonPanel rows={10} />
    </div>
  );
}
