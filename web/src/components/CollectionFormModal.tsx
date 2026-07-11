"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  createCollection,
  updateCollection,
  type Collection,
  type CreateCollectionInput,
  type Visibility,
} from "@/lib/collections";
import {
  createExternalMedia,
  updateMediaCrop,
  uploadMedia,
  type Crop,
  FULL_CROP,
} from "@/lib/media";
import { fileToWebp } from "@/lib/image";
import { coverStyle } from "@/lib/cover";
import ImageCropper from "./ImageCropper";

type Props = {
  mode: "create" | "edit";
  collection?: Collection;
  onClose: () => void;
  onSaved: (collection: Collection) => void;
};

type Cover = { mediaId: string; url: string; crop: Crop };
type Editing =
  | { kind: "file"; file: File }
  | { kind: "url"; url: string }
  | { kind: "existing"; mediaId: string; url: string; crop: Crop };

export default function CollectionFormModal({ mode, collection, onClose, onSaved }: Props) {
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [visibility, setVisibility] = useState<Visibility>(collection?.visibility ?? "PUBLIC");

  const initialCover: Cover | null = collection?.coverMediaId
    ? {
        mediaId: collection.coverMediaId,
        url: collection.coverUrl ?? "",
        crop: collection.coverCrop ?? FULL_CROP,
      }
    : null;
  const [cover, setCover] = useState<Cover | null>(initialCover);
  const [coverCleared, setCoverCleared] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [pendingCrop, setPendingCrop] = useState<Crop | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [chooserOpen, setChooserOpen] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0 && !saving && (editing === null || pendingCrop !== null);

  function closeChooser() {
    setChooserOpen(false);
    setLinkMode(false);
    setLinkValue("");
  }

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      setPendingCrop(null);
      setEditing({ kind: "file", file });
    }
  }

  function commitLink() {
    const url = linkValue.trim();
    if (!url) return;
    setPendingCrop(null);
    setEditing({ kind: "url", url });
    closeChooser();
  }

  function cropExisting() {
    if (!cover) return;
    setPendingCrop(null);
    setEditing({ kind: "existing", mediaId: cover.mediaId, url: cover.url, crop: cover.crop });
    closeChooser();
  }

  function removeCover() {
    setEditing(null);
    setPendingCrop(null);
    setCover(null);
    setCoverCleared(true);
    closeChooser();
  }

  function discardEditing() {
    setEditing(null);
    setPendingCrop(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);

    const payload: CreateCollectionInput & { clearCover?: boolean } = {
      name: name.trim(),
      description: description.trim() || undefined,
      visibility,
    };

    try {
      if (editing && pendingCrop) {
        if (editing.kind === "file") {
          const webp = await fileToWebp(editing.file);
          const media = await uploadMedia(webp, pendingCrop);
          payload.coverMediaId = media.id;
        } else if (editing.kind === "url") {
          const media = await createExternalMedia(editing.url, pendingCrop);
          payload.coverMediaId = media.id;
        } else {
          // Re-cropped an existing cover — just update its crop; cover id is unchanged.
          await updateMediaCrop(editing.mediaId, pendingCrop);
        }
      } else if (coverCleared) {
        payload.clearCover = true;
      }
    } catch {
      setError("Couldn't process the cover image. Please try another.");
      setSaving(false);
      return;
    }

    try {
      const saved =
        mode === "create"
          ? await createCollection(payload)
          : await updateCollection(collection!.id, payload);
      onSaved(saved);
    } catch {
      setError("Couldn't save. Please try again.");
      setSaving(false);
    }
  }

  const menuItem =
    "w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800";

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-end bg-slate-900/40 p-4 backdrop-blur-sm sm:place-items-center"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {mode === "create" ? "New collection" : "Edit collection"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Cover */}
        <label className="mt-4 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Cover <span className="text-slate-400">(optional)</span>
        </label>
        <div className="relative mt-1">
          {editing ? (
            <div className="relative">
              <ImageCropper
                file={editing.kind === "file" ? editing.file : undefined}
                imageUrl={editing.kind !== "file" ? editing.url : undefined}
                initialCrop={editing.kind === "existing" ? editing.crop : null}
                onCropChange={setPendingCrop}
              />
              <button
                type="button"
                onClick={discardEditing}
                aria-label="Discard"
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-slate-900/60 text-sm text-white transition hover:bg-slate-900/80"
              >
                ✕
              </button>
              <p className="mt-1 text-xs text-slate-400">Zoom and crop your image</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setChooserOpen(true)}
              className={`group relative block aspect-16/10 w-full overflow-hidden rounded-xl border ${
                cover
                  ? "border-slate-200 bg-cover bg-center dark:border-slate-700"
                  : "border-dashed border-slate-300 hover:border-teal-400 dark:border-slate-700"
              }`}
              style={cover ? coverStyle(cover.url, cover.crop) : undefined}
            >
              {cover ? (
                <span className="absolute inset-0 grid place-items-center text-sm font-medium text-white opacity-0 transition group-hover:bg-slate-900/40 group-hover:opacity-100">
                  Click to change
                </span>
              ) : (
                <span className="grid h-full w-full place-items-center text-sm text-slate-400 transition group-hover:text-teal-500">
                  Click to add a cover
                </span>
              )}
            </button>
          )}

          {chooserOpen && !editing && (
            <>
              <div className="fixed inset-0 z-40" onClick={closeChooser} />
              <div className="absolute left-1/2 top-1/2 z-50 w-64 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
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
                    {cover && (
                      <button type="button" onClick={cropExisting} className={menuItem}>
                        Crop &amp; zoom
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        closeChooser();
                        fileInputRef.current?.click();
                      }}
                      className={menuItem}
                    >
                      Upload image
                    </button>
                    <button type="button" onClick={() => setLinkMode(true)} className={menuItem}>
                      Embed image URL
                    </button>
                    {cover && (
                      <button
                        type="button"
                        onClick={removeCover}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                      >
                        Remove cover
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />
        </div>

        <label className="mt-4 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder="e.g. Coffee Gear"
          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-400 dark:border-slate-700 dark:bg-slate-800"
        />

        <label className="mt-4 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Description <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this collection about?"
          className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-400 dark:border-slate-700 dark:bg-slate-800"
        />

        <label className="mt-4 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Visibility
        </label>
        <div className="mt-1 inline-flex rounded-xl border border-slate-200 p-0.5 dark:border-slate-700">
          {(["PUBLIC", "PRIVATE"] as Visibility[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVisibility(v)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                visibility === v
                  ? "bg-teal-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {v === "PUBLIC" ? "Public" : "Private"}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            )}
            {saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
