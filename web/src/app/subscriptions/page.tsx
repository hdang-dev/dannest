"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import RequireAuth from "@/components/RequireAuth";
import { listSubscriptions, unfollowCollection } from "@/lib/follows";
import type { Collection } from "@/lib/collections";
import { gradientFor } from "@/lib/gradient";
import { coverStyle } from "@/lib/cover";

export default function SubscriptionsPage() {
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSubscriptions({ size: 100 })
      .then((page) => {
        if (!cancelled) setCollections(page.content);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your subscriptions.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUnfollow(c: Collection) {
    setBusyId(c.id);
    setError(null);
    try {
      await unfollowCollection(c.id);
      setCollections((cur) => cur?.filter((x) => x.id !== c.id) ?? null);
    } catch {
      setError("Unfollow failed. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <RequireAuth>
      <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Header />

        <main className="mx-auto max-w-2xl px-4 py-6">
          <h1 className="mb-4 text-lg font-bold">My Subscriptions</h1>

          {error && <p className="mb-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

          {collections === null ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : collections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                You&apos;re not following any collections yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {collections.map((c) => {
                const [from, to] = gradientFor(c.id);
                return (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                  >
                    <Link
                      href={`/collections/${c.id}`}
                      aria-label={`Open ${c.name}`}
                      className="grid aspect-16/10 place-items-center overflow-hidden rounded-t-2xl text-2xl"
                      style={
                        c.coverUrl
                          ? coverStyle(c.coverUrl, c.coverCrop)
                          : { background: `linear-gradient(135deg, ${from}, ${to})` }
                      }
                    >
                      {!c.coverUrl && (
                        <span className="font-bold text-white/90 drop-shadow-md">
                          {c.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </Link>
                    <div className="p-2.5">
                      <Link href={`/collections/${c.id}`}>
                        <p className="truncate text-sm font-semibold transition hover:text-teal-600 dark:hover:text-teal-400">
                          {c.name}
                        </p>
                        <p className="truncate text-xs text-slate-400">by {c.ownerUsername}</p>
                      </Link>
                      <button
                        onClick={() => handleUnfollow(c)}
                        disabled={busyId === c.id}
                        className="mt-2 w-full rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {busyId === c.id ? "Unfollowing…" : "Unfollow"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </RequireAuth>
  );
}
