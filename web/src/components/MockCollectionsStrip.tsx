"use client";

import Link from "next/link";
import { usePosts } from "@/lib/posts";
import { gradientFor } from "@/lib/gradient";

// Mock collections strip for the Post-lifecycle prototype. Each card links to the
// collection's post list. (Uses the client-side mock store, not the backend.)
export default function MockCollectionsStrip() {
  const { collections, posts } = usePosts();
  const visible = collections.filter((c) => !c.archived);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Collections</h2>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {visible.map((c) => {
          const [from, to] = gradientFor(c.id);
          const count = posts.filter((p) => p.collectionId === c.id && !p.archived).length;
          return (
            <Link
              key={c.id}
              href={`/collections/${c.id}`}
              className="w-32 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-teal-400 dark:border-slate-800 dark:bg-slate-900"
            >
              <div
                className="grid aspect-16/10 place-items-center text-3xl"
                style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
              >
                <span className="drop-shadow-md">{c.emoji}</span>
              </div>
              <div className="p-2">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {c.name}
                </p>
                <p className="text-xs text-slate-400">
                  {count} {count === 1 ? "post" : "posts"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
