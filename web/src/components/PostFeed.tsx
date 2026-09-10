"use client";

import PostCard from "./PostCard";
import { type Post } from "@/lib/posts";

type Props = {
  posts: Post[];
  onEdit: (post: Post) => void;
  onLike: (post: Post) => void;
  // From a notification deep link — the one post (and, for a reply, comment) to scroll to.
  focusPostId?: string | null;
  focusCommentId?: string | null;
  emptyLabel?: string;
};

export default function PostFeed({
  posts,
  onEdit,
  onLike,
  focusPostId,
  focusCommentId,
  emptyLabel = "Nothing here yet.",
}: Props) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="1.6" />
            <path d="m21 15-4.5-4.5L6 21" />
          </svg>
        </span>
        <p className="text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onEdit={onEdit}
          onLike={onLike}
          focusPostId={focusPostId}
          focusCommentId={focusCommentId}
        />
      ))}
    </div>
  );
}
