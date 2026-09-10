// Post-shaped loading placeholders for the feed — mirrors PostCard's layout so the
// page doesn't jump when the real posts arrive.

function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-slate-200 dark:bg-slate-800 ${className}`} />;
}

function PostCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* header */}
      <div className="flex items-center gap-3 p-4">
        <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="flex-1 space-y-2">
          <Bar className="h-3.5 w-32" />
          <Bar className="h-3 w-20" />
        </div>
      </div>

      {/* text */}
      <div className="space-y-2 px-4 pb-3">
        <Bar className="h-4 w-3/4" />
        <Bar className="h-3 w-full" />
        <Bar className="h-3 w-5/6" />
      </div>

      {/* image */}
      <div className="mx-4 aspect-4/3 rounded-xl bg-slate-200 dark:bg-slate-800" />

      {/* actions */}
      <div className="flex gap-2 p-3">
        <Bar className="h-8 w-16 rounded-full" />
        <Bar className="h-8 w-16 rounded-full" />
      </div>
    </div>
  );
}

export default function PostFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}
