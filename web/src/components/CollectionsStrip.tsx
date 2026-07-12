"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listCollections, type Collection } from "@/lib/collections";
import { gradientFor } from "@/lib/gradient";
import { coverStyle } from "@/lib/cover";

export default function CollectionsStrip() {
  const [collections, setCollections] = useState<Collection[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Across-platform public feed: newest 10 public collections from any user.
    listCollections({ scope: "PUBLIC", size: 10 })
      .then((page) => {
        if (!cancelled) setCollections(page.content);
      })
      .catch(() => {
        if (!cancelled) setCollections([]); // treat errors as "nothing to show"
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide the whole section while loading or when there are no public collections.
  if (!collections || collections.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Collections</h2>
        <Link
          href="/my-collections"
          className="text-xs font-medium text-teal-600 dark:text-teal-400"
        >
          My Collections
        </Link>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {collections.map((c) => {
          const [from, to] = gradientFor(c.id);
          return (
            <Link
              key={c.id}
              href={`/collections/${c.id}`}
              className="w-32 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-teal-400 dark:border-slate-800 dark:bg-slate-900"
            >
              <div
                className="grid aspect-16/10 place-items-center text-3xl"
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
              </div>
              <div className="p-2">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {c.name}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
