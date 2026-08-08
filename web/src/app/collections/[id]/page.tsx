"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import RequireAuth from "@/components/RequireAuth";
import PostFeed from "@/components/PostFeed";
import NewPostFab from "@/components/NewPostFab";
import PostComposerModal from "@/components/PostComposerModal";
import CollectionFormModal from "@/components/CollectionFormModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import DefaultAvatarIcon from "@/components/DefaultAvatarIcon";
import LoadingState from "@/components/LoadingState";
import { gradientFor } from "@/lib/gradient";
import { coverStyle } from "@/lib/cover";
import { FULL_CROP } from "@/lib/media";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { archiveCollection, getCollection, type Collection } from "@/lib/collections";
import { listByCollection, likePost, unlikePost, type Post } from "@/lib/posts";
import { followCollection, getFollowStatus, unfollowCollection } from "@/lib/follows";

type Composer = { mode: "create" } | { mode: "edit"; post: Post } | null;

export default function CollectionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  // From a notification deep link — scroll to (and, for a reply, open) this post/comment.
  const focusPostId = searchParams.get("post");
  const focusCommentId = searchParams.get("comment");
  const { user } = useAuth();
  const { notify } = useToast();
  const [collection, setCollection] = useState<Collection | null | undefined>(undefined);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [composer, setComposer] = useState<Composer>(null);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Load the real collection + its posts from the backend.
  useEffect(() => {
    let cancelled = false;
    getCollection(id)
      .then((c) => !cancelled && setCollection(c))
      .catch(() => !cancelled && setCollection(null));
    listByCollection(id, { size: 50 })
      .then((page) => !cancelled && setPosts(page.content))
      .catch(() => !cancelled && setPosts([]));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const mine = !!user && !!collection && collection.ownerId === user.id;
  const [from, to] = gradientFor(id);

  // Whether the caller follows this collection — only relevant once it's loaded and
  // isn't the caller's own (a visible-but-not-mine collection is always PUBLIC).
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (!collection || mine) return;
    let cancelled = false;
    getFollowStatus(id)
      .then((s) => !cancelled && setFollowing(s.following))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [collection, mine, id]);

  // Optimistic follow toggle — flip locally, then persist (revert on failure).
  async function toggleFollow() {
    if (following === null || followBusy) return;
    const next = !following;
    setFollowBusy(true);
    setFollowing(next);
    try {
      await (next ? followCollection(id) : unfollowCollection(id));
    } catch {
      setFollowing(!next);
      notify("Couldn't update follow status. Please try again.", "error");
    } finally {
      setFollowBusy(false);
    }
  }

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
        cur?.map((p) => (p.id === post.id ? { ...p, likedByMe: liked, likeCount: p.likeCount } : p)) ?? cur,
      );
    });
  }

  // A saved post: replace it if already listed, else prepend.
  function upsert(saved: Post) {
    notify(composer?.mode === "edit" ? "Post updated" : "Post created");
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

  async function handleArchive() {
    setArchiving(true);
    try {
      await archiveCollection(id);
      router.push("/my-collections");
    } catch {
      notify("Archive failed. Please try again.", "error");
      setArchiving(false);
      setConfirmingArchive(false);
    }
  }

  return (
    <RequireAuth>
      <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Header />

        {collection === undefined ? (
          <main className="mx-auto flex max-w-2xl px-4 py-6">
            <LoadingState />
          </main>
        ) : collection === null ? (
          <main className="mx-auto max-w-2xl px-4 py-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">Collection not found.</p>
          </main>
        ) : (
          <>
            <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
              {/* cover banner — shorter full-width strip; `cover` keeps the image's ratio
                  (trims overflow, never stretches) rather than the taller 16/10 crop box. */}
              <div
                className="relative h-48 overflow-hidden rounded-2xl sm:h-56"
                style={
                  collection.coverUrl
                    ? coverStyle(collection.coverUrl, null)
                    : { background: `linear-gradient(135deg, ${from}, ${to})` }
                }
              >
                <button
                  onClick={() => router.push("/")}
                  aria-label="Back"
                  className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-slate-900/40 text-white backdrop-blur-sm transition hover:bg-slate-900/60"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {mine && (
                  <div className="absolute right-3 top-3">
                    <button
                      onClick={() => setMenuOpen((v) => !v)}
                      aria-label="Collection options"
                      className="grid h-9 w-9 place-items-center rounded-full bg-slate-900/40 text-white backdrop-blur-sm transition hover:bg-slate-900/60"
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
                              setEditing(true);
                            }}
                            className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setMenuOpen(false);
                              setConfirmingArchive(true);
                            }}
                            className="w-full px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                          >
                            Archive
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* name overlay — pinned to the bottom, darkened so text stays readable over any cover */}
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-linear-to-t from-black/60 to-transparent p-4">
                  <div className="min-w-0">
                    {!collection.coverUrl && (
                      <div className="text-4xl font-bold text-white/90 drop-shadow-lg">
                        {collection.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <h1 className="mt-1 truncate text-2xl font-bold text-white drop-shadow-md">
                      {collection.name}
                    </h1>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {/* owner badge — distinct from each post's author (a public collection
                        may later hold posts from multiple contributors). */}
                    <Link
                      href={`/users/${collection.ownerId}`}
                      className="flex shrink-0 items-center gap-2 rounded-full bg-black/30 py-1 pl-1 pr-3 backdrop-blur-sm transition hover:bg-black/50"
                    >
                      <div className="shrink-0 rounded-full ring-2 ring-white/80">
                        {collection.ownerAvatarUrl ? (
                          <div
                            className="h-8 w-8 rounded-full"
                            style={coverStyle(collection.ownerAvatarUrl, collection.ownerAvatarCrop ?? FULL_CROP)}
                          />
                        ) : (
                          <DefaultAvatarIcon size={32} />
                        )}
                      </div>
                      <span className="max-w-24 truncate text-xs font-medium text-white">
                        {collection.ownerUsername}
                      </span>
                    </Link>

                    {!mine && (
                      <button
                        onClick={toggleFollow}
                        disabled={following === null || followBusy}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition disabled:opacity-50 ${
                          following
                            ? "bg-black/30 text-white hover:bg-black/50"
                            : "bg-teal-500/90 text-white hover:bg-teal-500"
                        }`}
                      >
                        {following ? "Following" : "Follow"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {collection.description && (
                <p className="text-sm text-slate-600 dark:text-slate-300">{collection.description}</p>
              )}

              <p className="text-sm text-slate-400">
                {collection.visibility === "PRIVATE" ? "Private · " : ""}
                {posts?.length ?? 0} {(posts?.length ?? 0) === 1 ? "post" : "posts"}
              </p>

              {posts === null ? (
                <LoadingState minHeight="30vh" />
              ) : (
                <PostFeed
                  posts={posts}
                  onEdit={(post) => setComposer({ mode: "edit", post })}
                  onLike={toggleLike}
                  focusPostId={focusPostId}
                  focusCommentId={focusCommentId}
                  emptyLabel="No posts in this collection yet."
                />
              )}
            </main>

            {mine && <NewPostFab onClick={() => setComposer({ mode: "create" })} />}
          </>
        )}
      </div>

      {composer && (
        <PostComposerModal
          mode={composer.mode}
          post={composer.mode === "edit" ? composer.post : undefined}
          defaultCollectionId={id}
          onClose={() => setComposer(null)}
          onSaved={upsert}
        />
      )}

      {editing && collection && (
        <CollectionFormModal
          mode="edit"
          collection={collection}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            notify("Collection updated");
            setCollection(saved);
            setEditing(false);
          }}
        />
      )}

      {confirmingArchive && (
        <ConfirmDialog
          title="Archive collection?"
          message={`"${collection?.name}" will move out of your active collections. You can restore it later.`}
          confirmLabel="Archive"
          danger
          busy={archiving}
          onConfirm={handleArchive}
          onCancel={() => setConfirmingArchive(false)}
        />
      )}
    </RequireAuth>
  );
}
