"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import RequireAuth from "@/components/RequireAuth";
import CollectionsStrip from "@/components/CollectionsStrip";
import PostFeed from "@/components/PostFeed";
import NewPostFab from "@/components/NewPostFab";
import PostComposerModal from "@/components/PostComposerModal";
import { listFeed, likePost, unlikePost, type Post } from "@/lib/posts";

type Composer = { mode: "create" } | { mode: "edit"; post: Post } | null;

export default function Home() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState<Composer>(null);

  useEffect(() => {
    let cancelled = false;
    listFeed({ size: 50 })
      .then((page) => !cancelled && setPosts(page.content))
      .catch(() => !cancelled && setError("Couldn't load the feed."));
    return () => {
      cancelled = true;
    };
  }, []);

  // Optimistic like toggle — flip locally, then persist (revert on failure).
  function toggleLike(post: Post) {
    const liked = post.likedByMe;
    setPosts((cur) =>
      cur?.map((p) =>
        p.id === post.id ? { ...p, likedByMe: !liked, likeCount: p.likeCount + (liked ? -1 : 1) } : p,
      ) ?? cur,
    );
    (liked ? unlikePost(post.id) : likePost(post.id)).catch(() => {
      setPosts((cur) =>
        cur?.map((p) =>
          p.id === post.id ? { ...p, likedByMe: liked, likeCount: p.likeCount } : p,
        ) ?? cur,
      );
    });
  }

  // A saved post: replace it if it's already in the feed, else prepend it.
  function upsert(saved: Post) {
    setComposer(null);
    setPosts((cur) => {
      if (!cur) return [saved];
      const i = cur.findIndex((p) => p.id === saved.id);
      if (i === -1) return [saved, ...cur];
      const copy = cur.slice();
      copy[i] = saved;
      return copy;
    });
  }

  return (
    <RequireAuth>
      <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Header />

        <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">
          <CollectionsStrip />

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

          {posts === null ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <PostFeed
              posts={posts}
              onEdit={(post) => setComposer({ mode: "edit", post })}
              onLike={toggleLike}
              emptyLabel="No posts yet — create your first one."
            />
          )}
        </main>

        <NewPostFab onClick={() => setComposer({ mode: "create" })} />
      </div>

      {composer && (
        <PostComposerModal
          mode={composer.mode}
          post={composer.mode === "edit" ? composer.post : undefined}
          onClose={() => setComposer(null)}
          onSaved={upsert}
        />
      )}
    </RequireAuth>
  );
}
