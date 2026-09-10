"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import DefaultAvatarIcon from "./DefaultAvatarIcon";
import ImageCropper from "./ImageCropper";
import PostGallery from "./PostGallery";
import { fileToWebp } from "@/lib/image";
import { coverStyle, croppedCoverStyle } from "@/lib/cover";
import { useAuth } from "@/lib/auth";
import {
  uploadMedia,
  createExternalMedia,
  updateMediaCrop,
  FULL_CROP,
  type Crop,
} from "@/lib/media";
import { listCollections, type Collection, type Visibility } from "@/lib/collections";
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

/** Emoji + label for a collection's visibility, as shown on a post's audience. */
function collectionTypeLabel(v: Visibility | "PUBLIC" | "PRIVATE"): string {
  if (v === "MEMBERS_ONLY") return "💰 Paid collection";
  if (v === "PRIVATE") return "🔒 Private collection";
  return "🌍 Public collection";
}

/** Just the emoji, for compact spots like the collection dropdown. */
function collectionTypeEmoji(v: Visibility): string {
  if (v === "MEMBERS_ONLY") return "💰";
  if (v === "PRIVATE") return "🔒";
  return "🌍";
}

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

/**
 * Resolve true only if `url` actually loads and decodes as an image in the
 * browser — the same check that decides whether it will render in the feed.
 */
function imageUrlLoads(url: string, timeoutMs = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const done = (ok: boolean) => {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    img.onload = () => done(img.naturalWidth > 0);
    img.onerror = () => done(false);
    img.src = url;
  });
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

function ArrowLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export default function PostComposerModal({ mode, post, defaultCollectionId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const authorName = user?.username ?? "You";

  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState(post?.collectionId ?? defaultCollectionId ?? "");
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.content ?? "");
  const [images, setImages] = useState<DraftImage[]>(post ? toDrafts(post.images) : []);
  const [chooserOpen, setChooserOpen] = useState(false); // "Add media" → URL / Media menu
  const [linkMode, setLinkMode] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkChecking, setLinkChecking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false); // full-screen list: crop / remove / add
  const [croppingKey, setCroppingKey] = useState<string | null>(null); // photo being cropped / selected
  const [collectionMenuOpen, setCollectionMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Large screens get a side-by-side photo editor (thumbnail grid + big inline
  // cropper) instead of the mobile list + full-screen cropper flow.
  const [isDesktopEditor, setIsDesktopEditor] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktopEditor(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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

  // Body textarea auto-grows with its content (from ~3 lines) until it hits its
  // max-height, then scrolls.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

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
  const cropping = images.find((img) => img.key === croppingKey) ?? null;
  // Desktop editor: the photo shown in the big right-hand cropper (falls back to
  // the first photo when nothing's explicitly selected).
  const activeImage = cropping ?? images[0] ?? null;

  // The draft photos in the shape PostGallery expects (display order = array order).
  const galleryImages = images.map((img, i) => ({
    mediaId: img.key,
    url: img.previewUrl,
    crop: img.crop,
    displayOrder: i,
  }));

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
    setLinkChecking(false);
    setLinkError(null);
  }

  // Only accept an image URL once we've confirmed it's a well-formed http(s) link
  // that actually loads as an image — no broken images get into a post.
  async function commitLink() {
    const url = linkValue.trim();
    if (!url || linkChecking) return;
    if (!/^https?:\/\/\S+$/i.test(url)) {
      setLinkError("Enter a full image URL starting with http:// or https://");
      return;
    }
    setLinkChecking(true);
    setLinkError(null);
    const ok = await imageUrlLoads(url);
    setLinkChecking(false);
    if (!ok) {
      setLinkError("That link didn't load as an image. Check the URL and try again.");
      return;
    }
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

  function updateCrop(key: string, crop: Crop) {
    setImages((cur) => cur.map((img) => (img.key === key ? { ...img, crop } : img)));
  }

  /** The URL / Media chooser body — reused by the composer dropdown and the editor's add tile. */
  function addMediaPanelBody() {
    return linkMode ? (
      <div className="p-1">
        <input
          type="url"
          autoFocus
          value={linkValue}
          onChange={(e) => {
            setLinkValue(e.target.value);
            setLinkError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commitLink())}
          placeholder="https://image-url…"
          className={`w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm outline-none dark:bg-slate-800 ${
            linkError
              ? "border-rose-400 focus:border-rose-400"
              : "border-slate-200 focus:border-teal-400 dark:border-slate-700"
          }`}
        />
        {linkError && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{linkError}</p>}
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setLinkMode(false);
              setLinkError(null);
            }}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Back
          </button>
          <button
            type="button"
            onClick={commitLink}
            disabled={!linkValue.trim() || linkChecking}
            className="rounded-full bg-teal-600 px-4 py-1 text-sm font-semibold text-white disabled:opacity-50"
          >
            {linkChecking ? "Checking…" : "Add"}
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
          Media
        </button>
        <button
          type="button"
          onClick={() => setLinkMode(true)}
          className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          URL
        </button>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      // Resolve each draft image to {mediaId, url, crop} (in display order) — Core
      // stores this snapshot directly rather than looking the media up itself.
      const postImages: { mediaId: string; url: string; crop: Crop }[] = [];
      for (const img of images) {
        if (img.source.kind === "file") {
          const webp = await fileToWebp(img.source.file, 1600, 0.85);
          const media = await uploadMedia(webp, img.crop);
          postImages.push({ mediaId: media.id, url: media.url, crop: img.crop });
        } else if (img.source.kind === "url") {
          const media = await createExternalMedia(img.source.url, img.crop);
          postImages.push({ mediaId: media.id, url: media.url, crop: img.crop });
        } else {
          let url = img.previewUrl;
          if (!sameCrop(img.crop, img.source.originalCrop)) {
            const media = await updateMediaCrop(img.source.mediaId, img.crop);
            url = media.url;
          }
          postImages.push({ mediaId: img.source.mediaId, url, crop: img.crop });
        }
      }
      const payload = {
        collectionId,
        title: title.trim(),
        // Always send a string (never undefined) so clearing the body on an edit
        // actually reaches the backend as "" → stored as null, rather than being
        // dropped from the PATCH and leaving the old text in place.
        content: body.trim(),
        images: postImages,
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
    <>
      <div
        className="fixed inset-0 z-40 grid place-items-stretch bg-slate-900/50 backdrop-blur-sm sm:place-items-center sm:p-4"
        onClick={onClose}
      >
        <form
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleSubmit}
          className={`${
            photoEditorOpen ? "hidden" : "flex"
          } h-full max-h-full w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl sm:border sm:border-slate-200 sm:dark:border-slate-800`}
        >
          {/* header */}
          <div className="relative border-b border-slate-100 px-4 py-3 text-center dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {mode === "create" ? "New post" : "Edit post"}
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
            {/* author, with the collection selector + audience tucked under the name */}
            <div className="flex items-center gap-3">
              {user?.avatarUrl ? (
                <div
                  className="h-10 w-10 shrink-0 rounded-full"
                  style={coverStyle(user.avatarUrl, user.avatarCrop ?? FULL_CROP)}
                />
              ) : (
                <DefaultAvatarIcon size={40} />
              )}
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
                                {c.visibility !== "PUBLIC" && (
                                  <span className="shrink-0 text-xs text-slate-400">
                                    {collectionTypeEmoji(c.visibility)}
                                  </span>
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
                    {collectionTypeLabel(visibility)}
                  </span>
                </div>
              </div>
            </div>

            {/* title */}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="What's this one about?"
              className="mt-4 w-full bg-transparent text-xl font-medium outline-none placeholder:text-slate-400 dark:text-slate-100"
            />

            {/* body — newlines are preserved; auto-grows as you type */}
            <textarea
              ref={bodyRef}
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add context, a caption, a thought… (optional)"
              className="mt-1 max-h-64 w-full resize-none overflow-y-auto bg-transparent text-sm leading-relaxed outline-none placeholder:text-slate-400 dark:text-slate-200"
            />

            {/* photos — one fixed-size block; add via the top-right button, crop /
                remove via the bottom-right Edit button */}
            <div className="relative mt-4">
              {images.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setChooserOpen(true)}
                  className="flex aspect-4/3 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-teal-400 hover:text-teal-500 dark:border-slate-600"
                >
                  <PhotoIcon />
                  <span className="text-xs font-medium">Drop your photos here</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setPhotoEditorOpen(true)}
                    aria-label="Edit photos"
                    className="block w-full overflow-hidden rounded-xl"
                  >
                    <PostGallery fixed images={galleryImages} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoEditorOpen(true)}
                    className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/75 [&_svg]:h-3.5 [&_svg]:w-3.5"
                  >
                    <CropIcon />
                    Edit
                  </button>
                </>
              )}

              {/* add-media dropdown — anchored to the "Add" button, top-right of the block */}
              {chooserOpen && !photoEditorOpen && (
                <div className="fixed inset-0 z-20" onClick={closeChooser} />
              )}
              <div className="absolute right-2 top-2 z-30">
                <button
                  type="button"
                  onClick={() => (chooserOpen ? closeChooser() : setChooserOpen(true))}
                  className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/75 [&_svg]:h-3.5 [&_svg]:w-3.5"
                >
                  <PhotoIcon />
                  Add
                </button>

                {chooserOpen && !photoEditorOpen && (
                  <div className="absolute right-0 top-full z-30 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                    {addMediaPanelBody()}
                  </div>
                )}
              </div>
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
          <div className="space-y-2 border-t border-slate-100 p-4 dark:border-slate-800">
            {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-rose-900 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="flex-1 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Posting…" : mode === "create" ? "Post" : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* photo editor (mobile / small) — vertical scroll list; crop opens its own view.
          Full-screen on mobile, a centred modal on sm+ (mirrors the composer). */}
      {photoEditorOpen && !isDesktopEditor && !cropping && (
        <div
          className="fixed inset-0 z-50 grid place-items-stretch sm:place-items-center sm:p-4"
          onClick={() => setPhotoEditorOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full max-h-full w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl sm:border sm:border-slate-200 sm:dark:border-slate-800"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPhotoEditorOpen(false)}
                aria-label="Back"
                className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <ArrowLeftIcon />
              </button>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit photos</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="mx-auto max-w-md space-y-4">
                {images.map((img, i) => (
                  <div
                    key={img.key}
                    className="relative aspect-4/3 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800"
                    style={croppedCoverStyle(img.previewUrl, img.crop, 4 / 3)}
                  >
                    {i === 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Cover
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(img.key)}
                      aria-label="Remove photo"
                      className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80"
                    >
                      ✕
                    </button>
                    <button
                      type="button"
                      onClick={() => setCroppingKey(img.key)}
                      aria-label="Crop photo"
                      className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/80 [&_svg]:h-3.5 [&_svg]:w-3.5"
                    >
                      <CropIcon />
                      Crop
                    </button>
                  </div>
                ))}

                {/* keep adding photos without leaving this view */}
                <button
                  type="button"
                  onClick={() => setChooserOpen(true)}
                  className="flex aspect-4/3 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-teal-400 hover:text-teal-500 dark:border-slate-600"
                >
                  <PhotoIcon />
                  <span className="text-xs font-medium">Drop your photos here</span>
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100 p-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPhotoEditorOpen(false)}
                className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* photo editor (large screens) — thumbnail grid on the left, a big inline
          cropper for the selected photo on the right. */}
      {photoEditorOpen && isDesktopEditor && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          onClick={() => setPhotoEditorOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit photos</h3>
              <button
                type="button"
                onClick={() => setPhotoEditorOpen(false)}
                className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-500"
              >
                Done
              </button>
            </div>

            <div className="flex min-h-0 flex-1">
              {/* left: thumbnails */}
              <div className="w-64 shrink-0 overflow-y-auto border-r border-slate-100 p-3 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  {images.map((img, i) => (
                    <div key={img.key} className="group relative">
                      <button
                        type="button"
                        onClick={() => setCroppingKey(img.key)}
                        aria-label={`Select photo ${i + 1}`}
                        className={`block aspect-4/3 w-full overflow-hidden rounded-lg ring-2 transition ${
                          activeImage?.key === img.key
                            ? "ring-teal-500"
                            : "ring-transparent hover:ring-slate-300 dark:hover:ring-slate-600"
                        }`}
                        style={croppedCoverStyle(img.previewUrl, img.crop, 4 / 3)}
                      />
                      {i === 0 && (
                        <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                          Cover
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(img.key)}
                        aria-label="Remove photo"
                        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/80"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setChooserOpen(true)}
                    className="flex aspect-4/3 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-teal-400 hover:text-teal-500 dark:border-slate-600"
                  >
                    <PhotoIcon />
                    <span className="text-[10px] font-medium">Add</span>
                  </button>
                </div>
              </div>

              {/* right: big cropper for the selected photo */}
              <div className="relative min-w-0 flex-1 bg-slate-900">
                {activeImage ? (
                  <ImageCropper
                    key={activeImage.key}
                    fill
                    imageUrl={activeImage.previewUrl}
                    initialCrop={activeImage.crop}
                    aspect={4 / 3}
                    onCropChange={(c) => updateCrop(activeImage.key, c)}
                  />
                ) : (
                  <div className="grid h-full place-items-center px-6 text-center text-sm text-slate-400">
                    Add a photo to start cropping.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* add-media menu when adding from inside the photo editor */}
      {chooserOpen && photoEditorOpen && (isDesktopEditor || !cropping) && (
        <>
          <div className="fixed inset-0 z-55" onClick={closeChooser} />
          <div className="fixed left-1/2 top-1/2 z-56 w-64 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            {addMediaPanelBody()}
          </div>
        </>
      )}

      {/* one photo's crop editor (mobile / small) — full-screen on mobile, modal on sm.
          On large screens the cropper lives in the two-pane editor instead. */}
      {cropping && !isDesktopEditor && (
        <div
          className="fixed inset-0 z-60 grid place-items-stretch sm:place-items-center sm:p-4"
          onClick={() => setCroppingKey(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full max-h-full w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl sm:border sm:border-slate-200 sm:dark:border-slate-800"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCroppingKey(null)}
                aria-label="Back"
                className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <ArrowLeftIcon />
              </button>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Crop photo</h3>
            </div>

            <div className="relative flex-1 bg-slate-900 sm:aspect-4/3 sm:flex-none">
              <ImageCropper
                key={cropping.key}
                fill
                imageUrl={cropping.previewUrl}
                initialCrop={cropping.crop}
                aspect={4 / 3}
                onCropChange={(c) => updateCrop(cropping.key, c)}
              />
            </div>

            <div className="border-t border-slate-100 p-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCroppingKey(null)}
                className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
