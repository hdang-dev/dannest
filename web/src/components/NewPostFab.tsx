"use client";

import { useState } from "react";

export default function NewPostFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* floating action button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="New post"
        className="fixed bottom-6 right-6 z-30 grid h-14 w-14 place-items-center rounded-full bg-teal-600 text-white shadow-lg transition hover:bg-teal-500 hover:shadow-xl active:scale-95"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>

      {/* composer modal */}
      {open && (
        <div
          className="fixed inset-0 z-40 grid place-items-end bg-slate-900/40 p-4 backdrop-blur-sm sm:place-items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">New post</h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <textarea
              rows={4}
              placeholder="Share something for your collection…"
              className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-400 dark:border-slate-700 dark:bg-slate-800"
            />

            <div className="mt-3 flex items-center gap-2">
              <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                🖼️ Photo
              </button>
              <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                🗂️ Collection
              </button>
              <button
                onClick={() => setOpen(false)}
                className="ml-auto rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-500"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
