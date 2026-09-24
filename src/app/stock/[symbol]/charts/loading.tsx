import { SkeletonBlock } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading charts">
      <SkeletonBlock className="h-2.5 w-24" />
      <SkeletonBlock className="h-6 w-64 max-w-full" />
      <SkeletonBlock className="h-8 w-72 max-w-full" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="panel p-3.5">
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className="mt-3 h-44" />
          </div>
        ))}
      </div>
    </div>
  );
}
