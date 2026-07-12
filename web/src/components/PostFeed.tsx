"use client";

import PostCard from "./PostCard";
import { type Post } from "@/lib/posts";

type Props = {
  posts: Post[];
  onEdit: (post: Post) => void;
  emptyLabel?: string;
};

export default function PostFeed({ posts, onEdit, emptyLabel = "Nothing here yet." }: Props) {
  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center dark:border-slate-700">
        <p className="text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onEdit={onEdit} />
      ))}
    </div>
  );
}
