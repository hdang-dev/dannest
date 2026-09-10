"use client";

// Shown in place of the empty home feed — a post-shaped welcome that doubles as a
// preview of the post format, with a CTA into the composer.

export default function WelcomeCard({ onCreate }: { onCreate: () => void }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* header */}
      <div className="flex items-center gap-3 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-sm font-bold text-white">
          D
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100">DanNest</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-sm text-slate-400">Hi there 👋</span>
          </div>
          <span className="mt-0.5 inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
            Getting started
          </span>
        </div>
      </div>

      {/* text */}
      <div className="px-4 pb-3">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">Welcome to the nest 🪺</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Bundle your photos into collections, then post to them. Public, private, or paid — your
          nest, your rules.
        </p>
      </div>

      {/* gradient hero — stands in for a post image */}
      <div className="relative mx-4 aspect-4/3 overflow-hidden rounded-xl bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-700">
        <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 -left-6 h-44 w-44 rounded-full bg-black/10" />
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-2xl font-bold tracking-tight text-white/95 drop-shadow-sm sm:text-3xl">
            Dan<span className="text-teal-100">Nest</span>
          </span>
        </div>
      </div>

      {/* action */}
      <div className="p-3">
        <button
          type="button"
          onClick={onCreate}
          className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500"
        >
          Post your first thing ✨
        </button>
      </div>
    </article>
  );
}
