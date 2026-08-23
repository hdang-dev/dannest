"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import RequireAuth from "@/components/RequireAuth";
import LoadingState from "@/components/LoadingState";
import { listActivity, type Activity } from "@/lib/activity";
import { formatRelativeTime } from "@/lib/time";

export default function ActivityPage() {
  const router = useRouter();
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listActivity({ size: 50 })
      .then((page) => !cancelled && setActivity(page.content))
      .catch(() => !cancelled && setError("Couldn't load your activity."));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RequireAuth>
      <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Header />

        <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">
          <h1 className="text-lg font-bold">My Activity</h1>

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

          {activity === null ? (
            <LoadingState />
          ) : activity.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nothing yet — post, like, comment, or follow something to see it here.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              {activity.map((a) => (
                <button
                  key={a.id}
                  onClick={() => router.push(a.targetUrl)}
                  className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  <span className="text-sm text-slate-700 dark:text-slate-200">{a.message}</span>
                  <span className="shrink-0 text-xs text-slate-400">{formatRelativeTime(a.createdAt)}</span>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    </RequireAuth>
  );
}
