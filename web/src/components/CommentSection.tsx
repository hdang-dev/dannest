"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import DefaultAvatarIcon from "./DefaultAvatarIcon";
import { formatRelativeTime } from "@/lib/time";
import { coverStyle } from "@/lib/cover";
import { FULL_CROP, type Crop } from "@/lib/media";
import { useAuth } from "@/lib/auth";
import {
  listComments,
  createComment,
  updateComment,
  deleteComment,
  type Comment,
} from "@/lib/comments";

const PAGE_SIZE = 10;

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 20v-6l8-2-8-2V4l19 8-19 8z" />
    </svg>
  );
}

function Avatar({ url, crop, size }: { url: string | null; crop: Crop | null; size: number }) {
  return url ? (
    <div className="shrink-0 rounded-full" style={{ width: size, height: size, ...coverStyle(url, crop ?? FULL_CROP) }} />
  ) : (
    <DefaultAvatarIcon size={size} />
  );
}

// 5 lines at leading-5 (20px) + vertical padding (py-1.5 = 12px) + the 1px top/bottom
// border — border-box sizing needs that last bit or the box is perpetually ~2px short
// of its own content and the scrollbar never turns off.
const COMPOSER_MAX_HEIGHT = 5 * 20 + 12 + 2;

/** A growable, multi-line composer: textarea + send button. Enter submits, Shift+Enter
 * inserts a newline; past 5 lines the box stops growing and scrolls internally. */
function Composer({
  placeholder,
  value,
  onChange,
  onSubmit,
  submitting,
  autoFocus,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, COMPOSER_MAX_HEIGHT)}px`;
  }, [value]);

  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={ref}
        autoFocus={autoFocus}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim() && !submitting) onSubmit();
          }
        }}
        placeholder={placeholder}
        style={{ maxHeight: COMPOSER_MAX_HEIGHT, resize: "none" }}
        className="min-w-0 flex-1 resize-none overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-sm leading-5 outline-none placeholder:text-slate-400 focus:border-teal-400 [&::-webkit-resizer]:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!value.trim() || submitting}
        aria-label="Send"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-600 text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <SendIcon />
      </button>
    </div>
  );
}

type Props = {
  postId: string;
  initialCount: number;
  onCountChange?: (count: number) => void;
};

export default function CommentSection({ postId, initialCount, onCountChange }: Props) {
  const { user } = useAuth();

  const [comments, setComments] = useState<Comment[] | null>(null);
  const [total, setTotal] = useState(initialCount);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ids always shown even while collapsed: the first page, plus anything the caller
  // just posted locally (so your own reply doesn't vanish behind "See less").
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  const [newText, setNewText] = useState("");
  const [posting, setPosting] = useState(false);

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    let cancelled = false;
    listComments(postId, { page: 0, size: PAGE_SIZE })
      .then((p) => {
        if (cancelled) return;
        setComments(p.content);
        setPage(0);
        setHasMore(!p.last);
        setTotal(p.totalElements);
        setPinnedIds(new Set(p.content.map((c) => c.id)));
        onCountChange?.(p.totalElements);
      })
      .catch(() => !cancelled && setError("Couldn't load comments."));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  function fetchNextPage() {
    setLoadingMore(true);
    setError(null);
    listComments(postId, { page: page + 1, size: PAGE_SIZE })
      .then((p) => {
        setComments((cur) => [...(cur ?? []), ...p.content]);
        setPage(p.page);
        setHasMore(!p.last);
      })
      .catch(() => setError("Couldn't load more comments."))
      .finally(() => setLoadingMore(false));
  }

  // Collapsed reveals the already-fetched extra pages instantly (no request); once
  // fully expanded, it fetches the next page from the server.
  function seeMore() {
    if (collapsed) {
      setCollapsed(false);
      return;
    }
    fetchNextPage();
  }

  function seeLess() {
    setCollapsed(true);
  }

  function postTopLevel() {
    const content = newText.trim();
    if (!content) return;
    setPosting(true);
    setError(null);
    createComment(postId, { content })
      .then((created) => {
        setComments((cur) => [...(cur ?? []), created]);
        setPinnedIds((cur) => new Set(cur).add(created.id));
        setNewText("");
        const next = total + 1;
        setTotal(next);
        onCountChange?.(next);
      })
      .catch(() => setError("Couldn't post your comment."))
      .finally(() => setPosting(false));
  }

  function postReply(parentId: string) {
    const content = replyText.trim();
    if (!content) return;
    setReplying(true);
    setError(null);
    createComment(postId, { content, parentCommentId: parentId })
      .then((created) => {
        setComments((cur) => [...(cur ?? []), created]);
        setPinnedIds((cur) => new Set(cur).add(created.id));
        setReplyText("");
        setReplyingTo(null);
        const next = total + 1;
        setTotal(next);
        onCountChange?.(next);
      })
      .catch(() => setError("Couldn't post your reply."))
      .finally(() => setReplying(false));
  }

  function saveEdit(id: string) {
    const content = editText.trim();
    if (!content) return;
    updateComment(id, content)
      .then((updated) => {
        setComments((cur) => cur?.map((c) => (c.id === id ? updated : c)) ?? cur);
        setEditingId(null);
      })
      .catch(() => setError("Couldn't save your changes."));
  }

  function remove(id: string) {
    if (!comments) return;
    // Deleting a comment cascades to its replies server-side — drop them locally too.
    const doomed = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of comments) {
        if (c.parentCommentId && doomed.has(c.parentCommentId) && !doomed.has(c.id)) {
          doomed.add(c.id);
          grew = true;
        }
      }
    }
    setComments(comments.filter((c) => !doomed.has(c.id)));
    const nextTotal = total - doomed.size;
    setTotal(nextTotal);
    onCountChange?.(nextTotal);
    deleteComment(id).catch(() => setError("Couldn't delete that comment."));
  }

  if (comments === null) {
    return (
      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        <p className="text-center text-xs text-slate-400">Loading comments…</p>
      </div>
    );
  }

  const visible = collapsed ? comments.filter((c) => pinnedIds.has(c.id)) : comments;
  const topLevel = visible.filter((c) => !c.parentCommentId);
  const repliesOf = (id: string) => visible.filter((c) => c.parentCommentId === id);
  // "See less" only makes sense once there's something extra loaded to hide.
  const canCollapse = !collapsed && comments.some((c) => !pinnedIds.has(c.id));

  function CommentRow({ comment, isReply }: { comment: Comment; isReply: boolean }) {
    const owned = !!user && user.id === comment.authorId;
    const edited = comment.updatedAt !== comment.createdAt;

    return (
      <div className={`flex gap-2.5 ${isReply ? "mt-2 ml-9" : "mt-3 first:mt-0"}`}>
        <Link href={`/users/${comment.authorId}`} className="shrink-0">
          <Avatar url={comment.authorAvatarUrl} crop={comment.authorAvatarCrop} size={isReply ? 26 : 32} />
        </Link>
        <div className="min-w-0 flex-1">
          {editingId === comment.id ? (
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Composer
                  placeholder="Edit your comment…"
                  value={editText}
                  onChange={setEditText}
                  onSubmit={() => saveEdit(comment.id)}
                  submitting={false}
                  autoFocus
                />
              </div>
              <button
                onClick={() => setEditingId(null)}
                className="mb-1.5 shrink-0 text-xs font-medium text-slate-400 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="inline-block rounded-2xl bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
              <Link
                href={`/users/${comment.authorId}`}
                className="text-xs font-semibold text-slate-900 hover:underline dark:text-slate-100"
              >
                {comment.authorUsername}
              </Link>
              <p className="whitespace-pre-wrap wrap-break-word text-sm leading-snug text-slate-700 dark:text-slate-200">
                {comment.content}
              </p>
            </div>
          )}

          {editingId !== comment.id && (
            <div className="mt-0.5 flex items-center gap-3 px-1 text-[11px] text-slate-400">
              <span>
                {formatRelativeTime(comment.createdAt)}
                {edited && " · edited"}
              </span>
              {!isReply && (
                <button
                  onClick={() => {
                    setReplyingTo(replyingTo === comment.id ? null : comment.id);
                    setReplyText("");
                  }}
                  className="font-semibold hover:underline"
                >
                  Reply
                </button>
              )}
              {owned && (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpenId(menuOpenId === comment.id ? null : comment.id)}
                    className="font-semibold hover:underline"
                  >
                    More
                  </button>
                  {menuOpenId === comment.id && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setMenuOpenId(null)} />
                      <div className="absolute left-0 top-full z-40 mt-1 w-28 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
                        <button
                          onClick={() => {
                            setMenuOpenId(null);
                            setEditingId(comment.id);
                            setEditText(comment.content);
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setMenuOpenId(null);
                            remove(comment.id);
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {replyingTo === comment.id && (
            <div className="mt-2 flex gap-2.5">
              <Avatar url={user?.avatarUrl ?? null} crop={user?.avatarCrop ?? null} size={26} />
              <div className="min-w-0 flex-1">
                <Composer
                  placeholder={`Reply to ${comment.authorUsername}…`}
                  value={replyText}
                  onChange={setReplyText}
                  onSubmit={() => postReply(comment.id)}
                  submitting={replying}
                  autoFocus
                />
              </div>
            </div>
          )}

          {repliesOf(comment.id).map((reply) => (
            <CommentRow key={reply.id} comment={reply} isReply />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
      {error && <p className="mb-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {topLevel.length === 0 ? (
        <p className="py-2 text-center text-xs text-slate-400">No comments yet — be the first to say something.</p>
      ) : (
        <div>
          {topLevel.map((c) => (
            <CommentRow key={c.id} comment={c} isReply={false} />
          ))}
        </div>
      )}

      {(hasMore || collapsed || canCollapse) && (
        <div className="mt-2 flex items-center gap-3">
          {(hasMore || collapsed) && (
            <button
              onClick={seeMore}
              disabled={loadingMore}
              className="text-xs font-semibold text-slate-500 hover:underline disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "See more comments"}
            </button>
          )}
          {canCollapse && (
            <button onClick={seeLess} className="text-xs font-semibold text-slate-500 hover:underline">
              See less
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2.5">
        <Avatar url={user?.avatarUrl ?? null} crop={user?.avatarCrop ?? null} size={32} />
        <div className="min-w-0 flex-1">
          <Composer
            placeholder="Write a comment…"
            value={newText}
            onChange={setNewText}
            onSubmit={postTopLevel}
            submitting={posting}
          />
        </div>
      </div>
    </div>
  );
}
