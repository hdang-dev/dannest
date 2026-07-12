"use client";

import { useState, type FormEvent } from "react";
import { usePosts, type MockCollection, type PostVisibility } from "@/lib/posts";

// Lightweight mock editor for a collection's name / emoji / visibility.
export default function CollectionEditModal({
  collection,
  onClose,
}: {
  collection: MockCollection;
  onClose: () => void;
}) {
  const { updateCollection } = usePosts();
  const [name, setName] = useState(collection.name);
  const [emoji, setEmoji] = useState(collection.emoji);
  const [visibility, setVisibility] = useState<PostVisibility>(collection.visibility);

  const canSave = name.trim().length > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    updateCollection(collection.id, { name: name.trim(), emoji: emoji.trim() || "🗂️", visibility });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-end bg-slate-900/40 p-4 backdrop-blur-sm sm:place-items-center"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit collection</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <label className="mt-4 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Name
        </label>
        <div className="mt-1 flex gap-2">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
            aria-label="Collection emoji"
            className="h-11 w-14 rounded-xl border border-slate-200 bg-slate-50 text-center text-lg outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-800"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="e.g. Coffee Gear"
            className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-400 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <label className="mt-4 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Visibility
        </label>
        <div className="mt-1 inline-flex rounded-xl border border-slate-200 p-0.5 dark:border-slate-700">
          {(["PUBLIC", "PRIVATE"] as PostVisibility[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVisibility(v)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                visibility === v
                  ? "bg-teal-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {v === "PUBLIC" ? "Public" : "Private"}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
