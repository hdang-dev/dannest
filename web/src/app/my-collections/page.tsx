"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import RequireAuth from "@/components/RequireAuth";
import CollectionFormModal from "@/components/CollectionFormModal";
import CollectionCard from "@/components/CollectionCard";
import {
  archiveCollection,
  listCollections,
  unarchiveCollection,
  type Collection,
  type Visibility,
} from "@/lib/collections";

type ModalState = { mode: "create" } | { mode: "edit"; collection: Collection } | null;
type VisibilityFilter = "ALL" | Visibility;

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [visFilter, setVisFilter] = useState<VisibilityFilter>("ALL");
  const [modal, setModal] = useState<ModalState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Search + filters run on the backend; debounced so typing doesn't fire per keystroke.
  useEffect(() => {
    let cancelled = false;
    const q = query.trim();
    const handle = setTimeout(
      () => {
        listCollections({
          size: 100,
          q: q || undefined,
          archived: showArchived || undefined,
          visibility: visFilter === "ALL" ? undefined : visFilter,
        })
          .then((page) => {
            if (!cancelled) {
              setCollections(page.content);
              setError(null);
            }
          })
          .catch(() => {
            if (!cancelled) setError("Couldn't load collections.");
          });
      },
      q ? 250 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, showArchived, visFilter]);

  function upsert(saved: Collection) {
    setModal(null);
    const matches = showArchived ? saved.archivedAt !== null : saved.archivedAt === null;
    setCollections((cur) => {
      if (!cur) return matches ? [saved] : [];
      const i = cur.findIndex((c) => c.id === saved.id);
      if (!matches) return i === -1 ? cur : cur.filter((c) => c.id !== saved.id);
      if (i === -1) return [saved, ...cur];
      const copy = cur.slice();
      copy[i] = saved;
      return copy;
    });
  }

  async function handleArchive(c: Collection) {
    if (!window.confirm(`Archive "${c.name}"? You can restore it later.`)) return;
    await mutate(c.id, () => archiveCollection(c.id), "Archive failed. Please try again.");
  }

  async function handleRestore(c: Collection) {
    await mutate(c.id, () => unarchiveCollection(c.id), "Restore failed. Please try again.");
  }

  // Archive/restore both move the item out of the current view, so drop it from the list.
  async function mutate(id: string, action: () => Promise<unknown>, failMsg: string) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      setCollections((cur) => cur?.filter((x) => x.id !== id) ?? null);
    } catch {
      setError(failMsg);
    } finally {
      setBusyId(null);
    }
  }

  const segBtn = (active: boolean) =>
    `rounded-full px-3.5 py-1 text-sm font-medium transition ${
      active
        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
    }`;

  return (
    <RequireAuth>
      <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Header />

        <main className="mx-auto max-w-2xl px-4 py-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="text-lg font-bold">My Collections</h1>
            <button
              onClick={() => setModal({ mode: "create" })}
              className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-500"
            >
              + New
            </button>
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search collections…"
            className="mb-3 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-400 dark:border-slate-800 dark:bg-slate-900"
          />

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full bg-slate-100 p-1 dark:bg-slate-800/60">
              <button className={segBtn(!showArchived)} onClick={() => setShowArchived(false)}>
                Active
              </button>
              <button className={segBtn(showArchived)} onClick={() => setShowArchived(true)}>
                Archived
              </button>
            </div>
            <div className="inline-flex rounded-full bg-slate-100 p-1 dark:bg-slate-800/60">
              {(["ALL", "PUBLIC", "PRIVATE"] as VisibilityFilter[]).map((v) => (
                <button key={v} className={segBtn(visFilter === v)} onClick={() => setVisFilter(v)}>
                  {v === "ALL" ? "All" : v === "PUBLIC" ? "Public" : "Private"}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="mb-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

          {collections === null ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : collections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {query.trim()
                  ? "No collections match your search."
                  : showArchived
                    ? "No archived collections."
                    : "No collections yet."}
              </p>
              {!query.trim() && !showArchived && (
                <button
                  onClick={() => setModal({ mode: "create" })}
                  className="mt-3 text-sm font-medium text-teal-600 dark:text-teal-400"
                >
                  Create your first one
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {collections.map((c) => (
                <CollectionCard
                  key={c.id}
                  collection={c}
                  busy={busyId === c.id}
                  onEdit={() => setModal({ mode: "edit", collection: c })}
                  onArchive={() => handleArchive(c)}
                  onRestore={() => handleRestore(c)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {modal && (
        <CollectionFormModal
          mode={modal.mode}
          collection={modal.mode === "edit" ? modal.collection : undefined}
          onClose={() => setModal(null)}
          onSaved={upsert}
        />
      )}
    </RequireAuth>
  );
}
