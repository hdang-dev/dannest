import { collections } from "@/lib/mock";

export default function CollectionsStrip() {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Collections</h2>
        <a href="#" className="text-xs font-medium text-teal-600 dark:text-teal-400">
          See all
        </a>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {collections.map((c) => (
          <a
            key={c.id}
            href="#"
            className="w-32 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700"
          >
            <div
              className="grid h-20 place-items-center text-3xl"
              style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
            >
              <span className="drop-shadow-md">{c.emoji}</span>
            </div>
            <div className="p-2">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{c.name}</p>
              <p className="text-xs text-slate-400 tabular-nums">{c.items} items</p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
