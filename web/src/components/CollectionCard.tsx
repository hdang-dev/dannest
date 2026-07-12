"use client";

import { useState } from "react";
import Link from "next/link";
import { type Collection } from "@/lib/collections";
import { gradientFor } from "@/lib/gradient";
import { coverStyle } from "@/lib/cover";
import { formatRelativeTime } from "@/lib/time";

type Props = {
  collection: Collection;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  busy: boolean;
};

export default function CollectionCard({ collection: c, onEdit, onArchive, onRestore, busy }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [from, to] = gradientFor(c.id);
  const archived = c.archivedAt !== null;

  return (
    // No overflow-hidden here, or it would clip the dropdown menu. The cover image
    // clips its own corners instead. Raise stacking while the menu is open so it
    // sits above neighboring cards.
    <div
      className={`relative rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${
        menuOpen ? "z-20" : ""
      }`}
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

      <div className="flex items-start gap-1 p-2.5">
        <Link href={`/collections/${c.id}`} className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold transition hover:text-teal-600 dark:hover:text-teal-400">
            {c.name}
          </p>
          <p className="text-xs text-slate-400">
            {c.visibility === "PRIVATE" ? "Private" : "Public"} · Edited{" "}
            {formatRelativeTime(c.updatedAt)}
          </p>
        </Link>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="More options"
            className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-40 mt-1 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Edit
                </button>
                {archived ? (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onRestore();
                    }}
                    disabled={busy}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-teal-600 transition hover:bg-teal-50 disabled:opacity-50 dark:text-teal-400 dark:hover:bg-teal-950/40"
                  >
                    {busy ? "Restoring…" : "Restore"}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onArchive();
                    }}
                    disabled={busy}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  >
                    {busy ? "Archiving…" : "Archive"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
