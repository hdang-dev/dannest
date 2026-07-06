"use client";

import { useState } from "react";
import Avatar from "./Avatar";
import { currentUser, type Post } from "@/lib/mock";

function formatCount(n: number) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);
}

export default function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(!!post.liked);
  const [saved, setSaved] = useState(!!post.saved);
  const [showComments, setShowComments] = useState(false);

  const likes = post.likes + (liked ? 1 : 0);
  const saves = post.saves + (saved ? 1 : 0);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* header */}
      <div className="flex items-center gap-3 p-4">
        <Avatar name={post.author.name} from={post.author.from} to={post.author.to} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{post.author.name}</span>
            <span className="text-sm text-slate-400">@{post.author.handle}</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-sm text-slate-400">{post.time}</span>
          </div>
          <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
            🗂️ {post.collection}
          </div>
        </div>
      </div>

      {/* text */}
      <div className="px-4 pb-3">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{post.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{post.body}</p>
      </div>

      {/* cover */}
      <div
        className="mx-4 grid h-52 place-items-center rounded-xl text-6xl"
        style={{ background: `linear-gradient(135deg, ${post.cover.from}, ${post.cover.to})` }}
      >
        <span className="drop-shadow-lg">{post.cover.emoji}</span>
      </div>

      {/* actions */}
      <div className="flex items-center gap-1 p-3">
        <button
          onClick={() => setLiked((v) => !v)}
          className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium tabular-nums transition ${
            liked
              ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
              : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span>{liked ? "❤️" : "🤍"}</span>
          {formatCount(likes)}
        </button>

        <button
          onClick={() => setShowComments((v) => !v)}
          className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium tabular-nums transition ${
            showComments
              ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
              : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          💬 {formatCount(post.comments.length)}
        </button>

        <button
          onClick={() => setSaved((v) => !v)}
          className={`ml-auto flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium tabular-nums transition ${
            saved
              ? "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"
              : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span>{saved ? "🔖" : "📑"}</span>
          {formatCount(saves)}
        </button>
      </div>

      {/* comments */}
      {showComments && (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex flex-col gap-3">
            {post.comments.length === 0 && (
              <p className="py-1 text-sm text-slate-400">No comments yet — be the first.</p>
            )}
            {post.comments.map((c, i) => (
              <div key={i} className="flex gap-2.5">
                <Avatar name={c.name} from={c.from} to={c.to} size={32} />
                <div className="min-w-0 rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c.name}</span>
                    <span className="text-xs text-slate-400">{c.time}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{c.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* add comment */}
          <div className="mt-3 flex items-center gap-2.5">
            <Avatar name={currentUser.name} from={currentUser.from} to={currentUser.to} size={32} />
            <input
              placeholder="Add a comment…"
              className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-400 dark:border-slate-700 dark:bg-slate-900"
            />
            <button className="text-sm font-semibold text-teal-600 dark:text-teal-400">Send</button>
          </div>
        </div>
      )}
    </article>
  );
}
