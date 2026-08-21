"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import RequireAuth from "@/components/RequireAuth";
import PostFeed from "@/components/PostFeed";
import LoadingState from "@/components/LoadingState";
import PostComposerModal from "@/components/PostComposerModal";
import { listTrending, likePost, unlikePost, type Post } from "@/lib/posts";

export default function TrendingPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTrending()
      .then((p) => !cancelled && setPosts(p))
      .catch(() => !cancelled && setError("Couldn't load trending posts."));
    return () => {
      cancelled = true;
    };
  }, []);

  // Optimistic like toggle, same pattern as the home feed. This card's own state
  // flips immediately either way, but the list order itself is a live ZREVRANGE
  // snapshot from the moment the page loaded — it re-ranks the next time you
  // land on this page, same as every other list here has no live-refresh.
  function toggleLike(post: Post) {
    const liked = post.likedByMe;
    setPosts((cur) =>
      cur?.map((p) =>
        p.id === post.id ? { ...p, likedByMe: !liked, likeCount: p.likeCount + (liked ? -1 : 1) } : p,
      ) ?? cur,
    );
    (liked ? unlikePost(post.id) : likePost(post.id)).catch(() => {
      setPosts((cur) =>
        cur?.map((p) => (p.id === post.id ? { ...p, likedByMe: liked, likeCount: p.likeCount } : p)) ?? cur,
      );
    });
  }

  function handleSaved(saved: Post) {
    setEditingPost(null);
    setPosts((cur) => cur?.map((p) => (p.id === saved.id ? saved : p)) ?? cur);
  }

  return (
    <RequireAuth>
      <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Header />

        <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">
          <h1 className="text-lg font-bold">Trending</h1>

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

          {posts === null ? (
            <LoadingState />
          ) : (
            <PostFeed
              posts={posts}
              onEdit={setEditingPost}
              onLike={toggleLike}
              emptyLabel="Nothing trending yet — like or comment on a post to get it started."
            />
          )}
        </main>
      </div>

      {editingPost && (
        <PostComposerModal
          mode="edit"
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSaved={handleSaved}
        />
      )}
    </RequireAuth>
  );
}
