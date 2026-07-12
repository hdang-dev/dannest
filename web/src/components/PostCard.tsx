"use client";

import { useState } from "react";
import Link from "next/link";
import Avatar from "./Avatar";
import { formatRelativeTime } from "@/lib/time";
import { usePosts, type Cover, type Post } from "@/lib/posts";

function formatCount(n: number) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);
}

/** A single image tile — a real uploaded photo, or a gradient + emoji stand-in. */
function ImageTile({
  image,
  className = "",
  emojiClass = "text-5xl",
  overlay,
}: {
  image: Cover;
  className?: string;
  emojiClass?: string;
  overlay?: number;
}) {
  const style = image.url
    ? { backgroundImage: `url("${image.url}")`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: `linear-gradient(135deg, ${image.from}, ${image.to})` };
  return (
    <div className={`relative grid place-items-center bg-slate-100 dark:bg-slate-800 ${className}`} style={style}>
      {!image.url && <span className={`${emojiClass} drop-shadow-lg`}>{image.emoji}</span>}
      {overlay ? (
        <div className="absolute inset-0 grid place-items-center bg-black/45 text-2xl font-semibold text-white">
          +{overlay}
        </div>
      ) : null}
    </div>
  );
}

/** Facebook-style image gallery: layout adapts to how many images a post has. */
function PostGallery({ images }: { images: Cover[] }) {
  const count = images.length;

  if (count === 1) {
    return (
      <div className="mx-4 overflow-hidden rounded-xl">
        <ImageTile image={images[0]} className="h-64" emojiClass="text-6xl" />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="mx-4 grid grid-cols-2 gap-1 overflow-hidden rounded-xl">
        {images.map((img, i) => (
          <ImageTile key={i} image={img} className="h-52" />
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="mx-4 grid h-64 grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-xl">
        <ImageTile image={images[0]} className="row-span-2 h-full" emojiClass="text-6xl" />
        <ImageTile image={images[1]} className="h-full" emojiClass="text-4xl" />
        <ImageTile image={images[2]} className="h-full" emojiClass="text-4xl" />
      </div>
    );
  }

  // 4+ → 2×2 grid, with a "+N" overlay on the last tile when there are extras.
  const shown = images.slice(0, 4);
  const extra = count - 4;
  return (
    <div className="mx-4 grid grid-cols-2 gap-1 overflow-hidden rounded-xl">
      {shown.map((img, i) => (
        <ImageTile
          key={i}
          image={img}
          className="h-40"
          emojiClass="text-4xl"
          overlay={i === 3 && extra > 0 ? extra : undefined}
        />
      ))}
    </div>
  );
}

export default function PostCard({ post, onEdit }: { post: Post; onEdit: (post: Post) => void }) {
  const { toggleLike, archivePost, unarchivePost, isOwnedByMe, collectionFor } = usePosts();
  const [showComments, setShowComments] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const owned = isOwnedByMe(post);
  const collection = collectionFor(post.collectionId);
  const edited = post.updatedAt !== post.createdAt;
  const timeLabel = edited
    ? `edited ${formatRelativeTime(post.updatedAt)}`
    : formatRelativeTime(post.createdAt);

  return (
    // No overflow-hidden here, or it would clip the ⋯ dropdown. Inner blocks round
    // their own corners instead. Raise stacking while the menu is open.
    <article
      className={`relative rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${
        menuOpen ? "z-20" : ""
      } ${post.archived ? "opacity-70" : ""}`}
    >
      {/* header */}
      <div className="flex items-center gap-3 p-4">
        <Avatar name={post.author.name} from={post.author.from} to={post.author.to} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{post.author.name}</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-sm text-slate-400">{timeLabel}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {collection && (
              <Link
                href={`/collections/${collection.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 transition hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-900/50"
              >
                {collection.name}
              </Link>
            )}
            {post.visibility === "PRIVATE" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                🔒 Private
              </span>
            )}
            {post.archived && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                Archived
              </span>
            )}
          </div>
        </div>

        {/* owner menu */}
        {owned && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Post options"
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-40 mt-1 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(post);
                    }}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Edit
                  </button>
                  {post.archived ? (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        unarchivePost(post.id);
                      }}
                      className="w-full px-3 py-2 text-left text-sm font-medium text-teal-600 transition hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/40"
                    >
                      Unhide
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        archivePost(post.id);
                      }}
                      className="w-full px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    >
                      Archive / hide
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* text */}
      <div className="px-4 pb-3">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{post.title}</h2>
        {post.body && (
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{post.body}</p>
        )}
      </div>

      {/* images — Facebook-style gallery, falls back to the single cover */}
      <PostGallery images={post.images?.length ? post.images : [post.cover]} />

      {/* actions */}
      <div className="flex items-center gap-1 p-3">
        <button
          onClick={() => toggleLike(post.id)}
          className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium tabular-nums transition ${
            post.liked
              ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
              : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span>{post.liked ? "❤️" : "🤍"}</span>
          {formatCount(post.likes)}
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
      </div>

      {/* comments — read-only for now (compose flow comes later) */}
      {showComments && (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex flex-col gap-3">
            {post.comments.length === 0 && (
              <p className="py-1 text-sm text-slate-400">No comments yet.</p>
            )}
            {post.comments.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <Avatar name={c.author.name} from={c.author.from} to={c.author.to} size={32} />
                <div className="min-w-0 rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c.author.name}</span>
                    <span className="text-xs text-slate-400">{c.time}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">💬 Commenting coming soon</p>
        </div>
      )}
    </article>
  );
}
