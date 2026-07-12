"use client";

import { useState } from "react";
import Header from "@/components/Header";
import RequireAuth from "@/components/RequireAuth";
import CollectionsStrip from "@/components/CollectionsStrip";
import PostFeed from "@/components/PostFeed";
import NewPostFab from "@/components/NewPostFab";
import PostComposerModal from "@/components/PostComposerModal";
import { usePosts, type Post } from "@/lib/posts";

type Composer = { mode: "create" } | { mode: "edit"; post: Post } | null;

export default function Home() {
  const { posts } = usePosts();
  const [composer, setComposer] = useState<Composer>(null);

  // Home feed = every active post. Archived (hidden) posts never appear here.
  const visible = posts.filter((p) => !p.archived);

  return (
    <RequireAuth>
      <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Header />

        <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">
          <CollectionsStrip />

          <PostFeed
            posts={visible}
            onEdit={(post) => setComposer({ mode: "edit", post })}
            emptyLabel="No posts yet — create your first one."
          />
        </main>

        <NewPostFab onClick={() => setComposer({ mode: "create" })} />
      </div>

      {composer && (
        <PostComposerModal
          mode={composer.mode}
          post={composer.mode === "edit" ? composer.post : undefined}
          onClose={() => setComposer(null)}
        />
      )}
    </RequireAuth>
  );
}
