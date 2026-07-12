"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Avatar from "./Avatar";
import { fileToWebp, blobToDataUrl } from "@/lib/image";
import { listCollections, type Collection } from "@/lib/collections";
import {
  usePosts,
  COVER_PALETTE,
  currentUser,
  type Cover,
  type Post,
  type PostVisibility,
} from "@/lib/posts";

type Props = {
  mode: "create" | "edit";
  post?: Post;
  defaultCollectionId?: string;
  onClose: () => void;
};

/** A photo in the composer: a Cover (real image url, or gradient stand-in) plus a stable key. */
type DraftImage = Cover & { key: string };

function draftKey() {
  try {
    return crypto.randomUUID();
  } catch {
    return "img" + Math.floor(performance.now() * 1000).toString(36);
  }
}

/** Seed the draft grid from a post's existing images (edit mode). */
function toDrafts(images: Cover[]): DraftImage[] {
  return images.map((img) => ({ ...img, key: draftKey() }));
}

export default function PostComposerModal({ mode, post, defaultCollectionId, onClose }: Props) {
  const { createPost, updatePost } = usePosts();
  const fileInput = useRef<HTMLInputElement>(null);

  // Real collections you own — the post's target collection (posts themselves stay mock).
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState(post?.collectionId ?? defaultCollectionId ?? "");
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [visibility, setVisibility] = useState<PostVisibility>(post?.visibility ?? "PUBLIC");
  const [images, setImages] = useState<DraftImage[]>(
    post ? toDrafts(post.images?.length ? post.images : [post.cover]) : [],
  );
  const [uploading, setUploading] = useState(0); // number of photos still processing
  const [dragKey, setDragKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCollections({ scope: "MINE", size: 100 })
      .then((page) => {
        if (cancelled) return;
        setCollections(page.content);
        // Default the target to the first collection once loaded (create mode).
        setCollectionId((cur) => cur || page.content[0]?.id || "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const canSave = title.trim().length > 0 && collectionId.length > 0 && uploading === 0;

  // Read picked files → downscaled WebP data URLs (mirrors the real upload flow, and
  // keeps the mock's in-memory images small even with many/large photos).
  async function addFiles(files: FileList | null) {
    if (!files) return;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (picked.length === 0) return;

    setUploading((n) => n + picked.length);
    await Promise.all(
      picked.map(async (file, i) => {
        try {
          const webp = await fileToWebp(file, 1600, 0.85);
          const url = await blobToDataUrl(webp);
          // Give it a palette gradient too, so it degrades gracefully if the url ever drops.
          const fallback = COVER_PALETTE[i % COVER_PALETTE.length];
          setImages((cur) => [...cur, { ...fallback, url, key: draftKey() }]);
        } catch {
          // Skip files that fail to decode; nothing to show for them.
        } finally {
          setUploading((n) => Math.max(0, n - 1));
        }
      }),
    );
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files);
    e.target.value = ""; // let the same file be re-picked later
  }

  function removeImage(key: string) {
    setImages((cur) => cur.filter((img) => img.key !== key));
  }

  // Lightweight drag-to-reorder — first photo becomes the post cover.
  function onDragEnter(overKey: string) {
    if (!dragKey || dragKey === overKey) return;
    setImages((cur) => {
      const from = cur.findIndex((i) => i.key === dragKey);
      const to = cur.findIndex((i) => i.key === overKey);
      if (from === -1 || to === -1) return cur;
      const next = [...cur];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    const clean: Cover[] = images.map((img) => ({
      from: img.from,
      to: img.to,
      emoji: img.emoji,
      url: img.url,
    }));
    const cover = clean[0] ?? COVER_PALETTE[0];
    const payload = {
      collectionId,
      title: title.trim(),
      body: body.trim(),
      cover,
      images: clean.length ? clean : undefined,
      visibility,
    };
    if (mode === "create") {
      createPost(payload);
    } else if (post) {
      updatePost(post.id, payload);
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-end bg-slate-900/50 p-4 backdrop-blur-sm sm:place-items-center"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* header */}
        <div className="relative border-b border-slate-100 px-4 py-3 text-center dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {mode === "create" ? "Create post" : "Edit post"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            ✕
          </button>
        </div>

        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* author + audience */}
          <div className="flex items-center gap-3">
            <Avatar name={currentUser.name} from={currentUser.from} to={currentUser.to} />
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">{currentUser.name}</div>
              <div className="mt-1 inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                {(["PUBLIC", "PRIVATE"] as PostVisibility[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      visibility === v
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    {v === "PUBLIC" ? "🌍 Public" : "🔒 Private"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            autoFocus
            placeholder={`What are you sharing, ${currentUser.name.split(" ")[0]}?`}
            className="mt-4 w-full bg-transparent text-xl font-medium outline-none placeholder:text-slate-400 dark:text-slate-100"
          />

          {/* body */}
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a little more… (optional)"
            className="mt-1 w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-slate-400 dark:text-slate-200"
          />

          {/* photo previews — Facebook-style thumbnail grid, drag to reorder */}
          {(images.length > 0 || uploading > 0) && (
            <div className="mt-2 rounded-2xl border border-slate-200 p-2 dark:border-slate-700">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {images.length} photo{images.length === 1 ? "" : "s"}
                  {images.length > 1 && " · drag to reorder · first is the cover"}
                </span>
                {images.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setImages([])}
                    className="text-xs font-medium text-rose-600 transition hover:underline dark:text-rose-400"
                  >
                    Remove all
                  </button>
                )}
              </div>

              <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
                {images.map((img, i) => (
                  <div
                    key={img.key}
                    draggable
                    onDragStart={() => setDragKey(img.key)}
                    onDragEnter={() => onDragEnter(img.key)}
                    onDragEnd={() => setDragKey(null)}
                    onDragOver={(e) => e.preventDefault()}
                    className={`group relative aspect-square cursor-grab overflow-hidden rounded-xl bg-slate-100 active:cursor-grabbing dark:bg-slate-800 ${
                      dragKey === img.key ? "opacity-50 ring-2 ring-teal-500" : ""
                    }`}
                    style={
                      img.url
                        ? { backgroundImage: `url("${img.url}")`, backgroundSize: "cover", backgroundPosition: "center" }
                        : { background: `linear-gradient(135deg, ${img.from}, ${img.to})` }
                    }
                  >
                    {!img.url && (
                      <span className="grid h-full w-full place-items-center text-3xl drop-shadow">{img.emoji}</span>
                    )}
                    {i === 0 && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Cover
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(img.key)}
                      aria-label="Remove photo"
                      className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white opacity-0 transition hover:bg-black/80 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* still-processing placeholders */}
                {Array.from({ length: uploading }).map((_, i) => (
                  <div
                    key={`u${i}`}
                    className="grid aspect-square animate-pulse place-items-center rounded-xl bg-slate-100 text-xs text-slate-400 dark:bg-slate-800"
                  >
                    …
                  </div>
                ))}

                {/* add-more tile */}
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-teal-400 hover:text-teal-500 dark:border-slate-600"
                >
                  <span className="text-2xl">＋</span>
                </button>
              </div>
            </div>
          )}

          {/* collection */}
          <label className="mt-4 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Add to collection
          </label>
          <select
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:border-teal-400 dark:border-slate-700 dark:bg-slate-800"
          >
            {collections.length === 0 && <option value="">No collections yet — create one first</option>}
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* add-to-your-post bar */}
          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5 dark:border-slate-700">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Add to your post</span>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              aria-label="Add photos"
              className="grid h-9 w-9 place-items-center rounded-full text-xl transition hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              🖼️
            </button>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            onChange={onPick}
            className="hidden"
          />
        </div>

        {/* footer */}
        <div className="border-t border-slate-100 p-4 dark:border-slate-800">
          <button
            type="submit"
            disabled={!canSave}
            className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading > 0 ? "Preparing photos…" : mode === "create" ? "Post" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
