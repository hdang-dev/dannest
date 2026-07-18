"use client";

import { useState } from "react";
import Link from "next/link";
import DefaultAvatarIcon from "./DefaultAvatarIcon";
import PostGallery from "./PostGallery";
import CommentSection from "./CommentSection";
import { formatRelativeTime } from "@/lib/time";
import { coverStyle } from "@/lib/cover";
import { FULL_CROP } from "@/lib/media";
import { useAuth } from "@/lib/auth";
import type { Post } from "@/lib/posts";

function formatCount(n: number) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);
}

type Props = {
  post: Post;
  onEdit: (post: Post) => void;
  onLike: (post: Post) => void;
};

export default function PostCard({ post, onEdit, onLike }: Props) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount);

  const owned = !!user && user.id === post.authorId;
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
      }`}
    >
      {/* header */}
      <div className="flex items-center gap-3 p-4">
        <Link href={`/users/${post.authorId}`} className="shrink-0">
          {post.authorAvatarUrl ? (
            <div
              className="h-10 w-10 rounded-full"
              style={coverStyle(post.authorAvatarUrl, post.authorAvatarCrop ?? FULL_CROP)}
            />
          ) : (
            <DefaultAvatarIcon size={40} />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <Link
              href={`/users/${post.authorId}`}
              className="font-semibold text-slate-900 hover:underline dark:text-slate-100"
            >
              {post.authorUsername}
            </Link>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-sm text-slate-400">{timeLabel}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <Link
              href={`/collections/${post.collectionId}`}
              className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 transition hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-900/50"
            >
              {post.collectionName}
            </Link>
            {post.collectionVisibility === "PRIVATE" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                🔒 Private
              </span>
            )}
          </div>
        </div>

        {/* owner menu — edit only */}
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
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* text */}
      <div className="px-4 pb-3">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{post.title}</h2>
        {post.content && (
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{post.content}</p>
        )}
      </div>

      {/* images — Facebook-style gallery */}
      <PostGallery images={post.images} />

      {/* actions */}
      <div className="flex items-center gap-1 p-3">
        <button
          onClick={() => onLike(post)}
          className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium tabular-nums transition ${
            post.likedByMe
              ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
              : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span>{post.likedByMe ? "❤️" : "🤍"}</span>
          {formatCount(post.likeCount)}
        </button>

        <button
          onClick={() => setShowComments((v) => !v)}
          className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium tabular-nums transition ${
            showComments
              ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
              : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          💬 {formatCount(commentCount)}
        </button>
      </div>

      {showComments && (
        <CommentSection postId={post.id} initialCount={post.commentCount} onCountChange={setCommentCount} />
      )}
    </article>
  );
}
