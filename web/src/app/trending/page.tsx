"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import RequireAuth from "@/components/RequireAuth";
import PostFeed from "@/components/PostFeed";
import LoadingState from "@/components/LoadingState";
import { listTrending, likePost, unlikePost, type Post } from "@/lib/posts";

export default function TrendingPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTrending()
      .then((p) => !cancelled && setPosts(p))
      .catch(() => !cancelled && setError("Couldn't load trending posts."));
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh button — trending has no caching and no live push (unlike the feed
  // and notifications), so a fresh fetch is the only way to see a like/comment's
  // effect on the ranking.
  function refresh() {
    setError(null);
    listTrending()
      .then(setPosts)
      .catch(() => setError("Couldn't load trending posts."));
  }

  // Optimistic like toggle, same pattern as the home feed — but note this only
  // flips this card's own state. The list itself is a live ZREVRANGE snapshot
  // from the moment it was fetched, so it never re-ranks in place; hit Refresh
  // to see the new order.
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

  return (
    <RequireAuth>
      <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Header />

        <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Trending</h1>
            <button
              onClick={refresh}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

          {posts === null ? (
            <LoadingState />
          ) : (
            <PostFeed
              posts={posts}
              // Editing isn't wired up here — this page is read + like only, kept
              // deliberately minimal since it exists to make trending visible,
              // not to duplicate the home feed's full post-management UI.
              onEdit={() => {}}
              onLike={toggleLike}
              emptyLabel="Nothing trending yet — like or comment on a post to get it started."
            />
          )}
        </main>
      </div>
    </RequireAuth>
  );
}
