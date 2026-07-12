"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Avatar from "./Avatar";
import ImageCropper from "./ImageCropper";
import PostGallery from "./PostGallery";
import { fileToWebp } from "@/lib/image";
import { coverStyle } from "@/lib/cover";
import { gradientFor } from "@/lib/gradient";
import { useAuth } from "@/lib/auth";
import {
  uploadMedia,
  createExternalMedia,
  updateMediaCrop,
  FULL_CROP,
  type Crop,
} from "@/lib/media";
import { listCollections, type Collection } from "@/lib/collections";
import { createPost, updatePost, type Post } from "@/lib/posts";

type Props = {
  mode: "create" | "edit";
  post?: Post;
  defaultCollectionId?: string;
  onClose: () => void;
  onSaved: (post: Post) => void;
};

/** Where a draft image comes from — decides what happens to it at submit. */
type DraftSource =
  | { kind: "file"; file: File }
  | { kind: "url"; url: string }
  | { kind: "existing"; mediaId: string; originalCrop: Crop };

/** A photo in the composer: a preview + display crop + its source, plus a stable key. */
type DraftImage = { key: string; previewUrl: string; crop: Crop; source: DraftSource };

function draftKey() {
  try {
    return crypto.randomUUID();
  } catch {
    return "img" + Math.floor(performance.now() * 1000).toString(36);
  }
}

function sameCrop(a: Crop, b: Crop) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/** Seed the draft grid from a post's existing images (edit mode). */
function toDrafts(images: Post["images"]): DraftImage[] {
  return images.map((img) => ({
    key: draftKey(),
    previewUrl: img.url,
    crop: img.crop,
    source: { kind: "existing", mediaId: img.mediaId, originalCrop: img.crop },
  }));
}

function CropIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="1.6" />
      <path d="m21 15-4.5-4.5L6 21" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function PostComposerModal({ mode, post, defaultCollectionId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);

  const authorName = user?.username ?? "You";
  const [authorFrom, authorTo] = gradientFor(user?.id ?? "you");

  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState(post?.collectionId ?? defaultCollectionId ?? "");
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.content ?? "");
  const [images, setImages] = useState<DraftImage[]>(post ? toDrafts(post.images) : []);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false); // "Add image" → upload / URL menu
  const [linkMode, setLinkMode] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [croppingKey, setCroppingKey] = useState<string | null>(null);
  const [preview, setPreview] = useState(false); // Edit ↔ Preview (review before posting)
  const [collectionMenuOpen, setCollectionMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Revoke any object URLs we created for file previews when the modal unmounts.
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(
    () => () => {
      imagesRef.current.forEach((img) => {
        if (img.source.kind === "file") URL.revokeObjectURL(img.previewUrl);
      });
    },
    [],
  );

  // A post inherits its audience from its collection — there's no per-post visibility.
  const selectedCollection = collections.find((c) => c.id === collectionId);
  const visibility = selectedCollection?.visibility ?? post?.collectionVisibility ?? "PUBLIC";

  const canSave = title.trim().length > 0 && collectionId.length > 0 && !saving;
  const cropping = images.find((img) => img.key === croppingKey);

  // Picked files preview instantly via object URLs; they're uploaded to R2 at submit.
  function addFiles(files: FileList | null) {
    if (!files) return;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (picked.length === 0) return;
    const drafts: DraftImage[] = picked.map((file) => ({
      key: draftKey(),
      previewUrl: URL.createObjectURL(file),
      crop: FULL_CROP,
      source: { kind: "file", file },
    }));
    setImages((cur) => [...cur, ...drafts]);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files);
    e.target.value = ""; // let the same file be re-picked later
  }

  function closeChooser() {
    setChooserOpen(false);
    setLinkMode(false);
    setLinkValue("");
  }

  function commitLink() {
    const url = linkValue.trim();
    if (!url) return;
    setImages((cur) => [
      ...cur,
      { key: draftKey(), previewUrl: url, crop: FULL_CROP, source: { kind: "url", url } },
    ]);
    closeChooser();
  }

  function removeImage(key: string) {
    setImages((cur) => {
      const target = cur.find((i) => i.key === key);
      if (target?.source.kind === "file") URL.revokeObjectURL(target.previewUrl);
      return cur.filter((i) => i.key !== key);
    });
    if (croppingKey === key) setCroppingKey(null);
  }

  function removeAll() {
    images.forEach((img) => {
      if (img.source.kind === "file") URL.revokeObjectURL(img.previewUrl);
    });
    setImages([]);
  }

  function updateCrop(key: string, crop: Crop) {
    setImages((cur) => cur.map((img) => (img.key === key ? { ...img, crop } : img)));
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      // Resolve each draft image to a mediaId (in display order).
      const mediaIds: string[] = [];
      for (const img of images) {
        if (img.source.kind === "file") {
          const webp = await fileToWebp(img.source.file, 1600, 0.85);
          const media = await uploadMedia(webp, img.crop);
          mediaIds.push(media.id);
        } else if (img.source.kind === "url") {
          const media = await createExternalMedia(img.source.url, img.crop);
          mediaIds.push(media.id);
        } else {
          if (!sameCrop(img.crop, img.source.originalCrop)) {
            await updateMediaCrop(img.source.mediaId, img.crop);
          }
          mediaIds.push(img.source.mediaId);
        }
      }
      const payload = {
        collectionId,
        title: title.trim(),
        content: body.trim() || undefined,
        mediaIds,
      };
      const saved =
        mode === "create" ? await createPost(payload) : await updatePost(post!.id, payload);
      onSaved(saved);
      onClose();
    } catch {
      setError("Couldn't save your post. Please try again.");
      setSaving(false);
    }
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
          {preview ? (
            /* ---- review: the post as it will appear ---- */
            <article className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 p-4">
                <Avatar name={authorName} from={authorFrom} to={authorTo} />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{authorName}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {selectedCollection && (
                      <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                        {selectedCollection.name}
                      </span>
                    )}
                    {visibility === "PRIVATE" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        🔒 Private
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-4 pb-3">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  {title.trim() || "Untitled post"}
                </h2>
                {body.trim() && (
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{body.trim()}</p>
                )}
              </div>
              <PostGallery
                images={images.map((img, i) => ({
                  mediaId: img.key,
                  url: img.previewUrl,
                  crop: img.crop,
                  displayOrder: i,
                }))}
              />
              <div className="flex items-center gap-3 p-3 text-sm text-slate-400">
                <span>🤍 0</span>
                <span>💬 0</span>
              </div>
            </article>
          ) : (
            <>
              {/* author, with the collection selector + audience tucked under the name */}
              <div className="flex items-center gap-3">
                <Avatar name={authorName} from={authorFrom} to={authorTo} />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{authorName}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {/* collection dropdown — custom so the menu is fully styled */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setCollectionMenuOpen((v) => !v)}
                        className="flex max-w-44 items-center gap-1 rounded-md bg-slate-100 py-1 pl-2.5 pr-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <span className="truncate">{selectedCollection?.name ?? "Select collection"}</span>
                        <span className="shrink-0 text-slate-400">
                          <ChevronDownIcon />
                        </span>
                      </button>

                      {collectionMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setCollectionMenuOpen(false)} />
                          <div className="absolute left-0 top-full z-40 mt-1.5 max-h-60 w-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                            {collections.length === 0 && (
                              <div className="px-3 py-2 text-xs text-slate-400">
                                No collections yet — create one first
                              </div>
                            )}
                            {collections.map((c) => {
                              const active = c.id === collectionId;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setCollectionId(c.id);
                                    setCollectionMenuOpen(false);
                                  }}
                                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                                    active
                                      ? "bg-teal-50 font-medium text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"
                                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                  }`}
                                >
                                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                                  {c.visibility === "PRIVATE" && (
                                    <span className="shrink-0 text-xs text-slate-400">🔒</span>
                                  )}
                                  {active && (
                                    <span className="shrink-0 text-teal-600 dark:text-teal-400">
                                      <CheckIcon />
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                    {/* audience — inherited from the collection */}
                    <span
                      title="A post's audience follows its collection"
                      className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    >
                      {visibility === "PUBLIC" ? "🌍 Public" : "🔒 Private"}
                    </span>
                  </div>
                </div>
              </div>

              {/* title */}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder={`What are you sharing, ${authorName}?`}
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

              {/* photos */}
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Photos</label>
                  {images.length > 0 && !cropping && (
                    <button
                      type="button"
                      onClick={removeAll}
                      className="text-xs font-medium text-rose-500 transition hover:text-rose-600 hover:underline"
                    >
                      Remove all
                    </button>
                  )}
                </div>

                {cropping ? (
                  /* ---- inline crop / zoom editor for one image ---- */
                  <div>
                    <ImageCropper
                      imageUrl={cropping.previewUrl}
                      initialCrop={cropping.crop}
                      aspect={1}
                      onCropChange={(c) => updateCrop(cropping.key, c)}
                    />
                    <div className="mt-2 flex items-center justify-between px-1">
                      <span className="text-xs text-slate-400">Scroll or pinch to zoom · drag to reposition</span>
                      <button
                        type="button"
                        onClick={() => setCroppingKey(null)}
                        className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-500"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {images.map((img, i) => (
                        <div
                          key={img.key}
                          draggable
                          onDragStart={() => setDragKey(img.key)}
                          onDragEnter={() => onDragEnter(img.key)}
                          onDragEnd={() => setDragKey(null)}
                          onDragOver={(e) => e.preventDefault()}
                          className={`group relative aspect-square cursor-grab overflow-hidden rounded-xl bg-slate-100 shadow-sm ring-1 ring-black/5 active:cursor-grabbing dark:bg-slate-800 ${
                            dragKey === img.key ? "opacity-50 ring-2 ring-teal-500" : ""
                          }`}
                          style={coverStyle(img.previewUrl, img.crop)}
                        >
                          {i === 0 && (
                            <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                              Cover
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImage(img.key)}
                            aria-label="Remove photo"
                            className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition hover:bg-black/75 group-hover:opacity-100"
                          >
                            ✕
                          </button>
                          <button
                            type="button"
                            onClick={() => setCroppingKey(img.key)}
                            aria-label="Crop and zoom"
                            className="absolute bottom-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition hover:bg-black/75 group-hover:opacity-100"
                          >
                            <CropIcon />
                          </button>
                        </div>
                      ))}

                      {/* add-image placeholder — simple "Add image"; click opens Upload / URL */}
                      <button
                        type="button"
                        onClick={() => setChooserOpen(true)}
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-teal-400 hover:text-teal-500 dark:border-slate-600 ${
                          images.length === 0 ? "col-span-full py-10" : "aspect-square"
                        }`}
                      >
                        <PhotoIcon />
                        <span className="text-xs font-medium">Add image</span>
                      </button>
                    </div>

                    {images.length > 1 && (
                      <p className="mt-2 px-0.5 text-[11px] text-slate-400">
                        Drag to reorder · the first photo is the cover
                      </p>
                    )}
                  </>
                )}

                {/* chooser popover — Upload image / Embed image URL (mirrors the collection modal) */}
                {chooserOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={closeChooser} />
                    <div className="fixed left-1/2 top-1/2 z-50 w-64 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                      {linkMode ? (
                        <div className="p-1">
                          <input
                            type="url"
                            autoFocus
                            value={linkValue}
                            onChange={(e) => setLinkValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commitLink())}
                            placeholder="https://image-url…"
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-800"
                          />
                          <div className="mt-2 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setLinkMode(false)}
                              className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              Back
                            </button>
                            <button
                              type="button"
                              onClick={commitLink}
                              disabled={!linkValue.trim()}
                              className="rounded-full bg-teal-600 px-4 py-1 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => {
                              closeChooser();
                              fileInput.current?.click();
                            }}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Upload image
                          </button>
                          <button
                            type="button"
                            onClick={() => setLinkMode(true)}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Embed image URL
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

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
        <div className="space-y-2 border-t border-slate-100 p-4 dark:border-slate-800">
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className="w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {preview ? "Edit" : "Review"}
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Posting…" : mode === "create" ? "Post" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
