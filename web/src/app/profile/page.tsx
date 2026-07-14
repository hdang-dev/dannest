"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Header from "@/components/Header";
import RequireAuth from "@/components/RequireAuth";
import DefaultAvatarIcon from "@/components/DefaultAvatarIcon";
import ImageCropper from "@/components/ImageCropper";
import { useAuth } from "@/lib/auth";
import { coverStyle } from "@/lib/cover";
import { formatJoinDate } from "@/lib/time";
import { createExternalMedia, uploadMedia, updateMediaCrop, FULL_CROP, type Crop } from "@/lib/media";
import { fileToWebp } from "@/lib/image";
import { getProfile, updateMyProfile, type Profile } from "@/lib/profile";

// Source being cropped in the avatar editor.
type AvatarEditing =
  | { kind: "file"; file: File; initialCrop: Crop }
  | { kind: "url"; url: string; initialCrop: Crop }
  | { kind: "existing"; mediaId: string; url: string; initialCrop: Crop };

// A committed-but-unsaved avatar change — resolved (uploaded/cropped) on Save.
// `previewUrl`/`avatar.avatarMediaId` here is the user's own upload/embed only;
// it is never the OAuth provider photo.
type PendingAvatar =
  | { kind: "file"; file: File; crop: Crop; previewUrl: string }
  | { kind: "url"; url: string; crop: Crop; previewUrl: string }
  | { kind: "existing"; mediaId: string; crop: Crop; previewUrl: string }
  | { kind: "clear" };

export default function ProfilePage() {
  const { user, updateUser } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [draftUsername, setDraftUsername] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [pendingAvatar, setPendingAvatar] = useState<PendingAvatar | null>(null);

  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [avatarEditing, setAvatarEditing] = useState<AvatarEditing | null>(null);
  const [pendingCrop, setPendingCrop] = useState<Crop | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getProfile(user.id)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load your profile.");
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function startEditing() {
    if (!profile) return;
    setDraftUsername(profile.username);
    setDraftBio(profile.bio ?? "");
    setPendingAvatar(null);
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    closeAvatarMenu();
    setAvatarEditing(null);
    setPendingCrop(null);
    setPendingAvatar(null);
    setError(null);
    setEditing(false);
  }

  function closeAvatarMenu() {
    setAvatarMenuOpen(false);
    setLinkMode(false);
    setLinkValue("");
  }

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      setPendingCrop(null);
      setAvatarEditing({ kind: "file", file, initialCrop: FULL_CROP });
      closeAvatarMenu();
    }
  }

  function commitLink() {
    const url = linkValue.trim();
    if (!url) return;
    setPendingCrop(null);
    setAvatarEditing({ kind: "url", url, initialCrop: FULL_CROP });
    closeAvatarMenu();
  }

  function cropCurrent() {
    if (pendingAvatar && pendingAvatar.kind !== "clear") {
      if (pendingAvatar.kind === "existing") {
        setAvatarEditing({
          kind: "existing",
          mediaId: pendingAvatar.mediaId,
          url: pendingAvatar.previewUrl,
          initialCrop: pendingAvatar.crop,
        });
      } else if (pendingAvatar.kind === "file") {
        setAvatarEditing({ kind: "file", file: pendingAvatar.file, initialCrop: pendingAvatar.crop });
      } else {
        setAvatarEditing({ kind: "url", url: pendingAvatar.url, initialCrop: pendingAvatar.crop });
      }
    } else if (profile?.avatarMediaId && profile.avatarUrl) {
      setAvatarEditing({
        kind: "existing",
        mediaId: profile.avatarMediaId,
        url: profile.avatarUrl,
        initialCrop: profile.avatarCrop ?? FULL_CROP,
      });
    } else {
      return;
    }
    setPendingCrop(null);
    closeAvatarMenu();
  }

  function removeAvatar() {
    setPendingAvatar({ kind: "clear" });
    closeAvatarMenu();
  }

  function applyAvatarCrop() {
    if (!avatarEditing || !pendingCrop) return;
    if (avatarEditing.kind === "file") {
      setPendingAvatar({
        kind: "file",
        file: avatarEditing.file,
        crop: pendingCrop,
        previewUrl: URL.createObjectURL(avatarEditing.file),
      });
    } else if (avatarEditing.kind === "url") {
      setPendingAvatar({ kind: "url", url: avatarEditing.url, crop: pendingCrop, previewUrl: avatarEditing.url });
    } else {
      setPendingAvatar({
        kind: "existing",
        mediaId: avatarEditing.mediaId,
        crop: pendingCrop,
        previewUrl: avatarEditing.url,
      });
    }
    setAvatarEditing(null);
    setPendingCrop(null);
  }

  function discardAvatarEditing() {
    setAvatarEditing(null);
    setPendingCrop(null);
  }

  async function save() {
    if (!profile) return;
    const username = draftUsername.trim();
    if (!username) return;
    setSaving(true);
    setError(null);

    let avatarMediaId: string | undefined;
    let clearAvatar: boolean | undefined;
    try {
      if (pendingAvatar) {
        if (pendingAvatar.kind === "clear") {
          clearAvatar = true;
        } else if (pendingAvatar.kind === "file") {
          const webp = await fileToWebp(pendingAvatar.file);
          const media = await uploadMedia(webp, pendingAvatar.crop, "avatar.webp");
          avatarMediaId = media.id;
        } else if (pendingAvatar.kind === "url") {
          const media = await createExternalMedia(pendingAvatar.url, pendingAvatar.crop);
          avatarMediaId = media.id;
        } else {
          await updateMediaCrop(pendingAvatar.mediaId, pendingAvatar.crop);
        }
      }
    } catch {
      setError("Couldn't process the photo. Please try another.");
      setSaving(false);
      return;
    }

    try {
      const updated = await updateMyProfile({
        username: username !== profile.username ? username : undefined,
        bio: draftBio !== (profile.bio ?? "") ? draftBio : undefined,
        avatarMediaId,
        clearAvatar,
      });
      setProfile(updated);
      updateUser({ username: updated.username, avatarUrl: updated.avatarUrl, avatarCrop: updated.avatarCrop });
      setPendingAvatar(null);
      setEditing(false);
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const menuItem =
    "w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800";

  const currentAvatar: { url: string; crop: Crop } | null = editing
    ? pendingAvatar
      ? pendingAvatar.kind === "clear"
        ? null
        : { url: pendingAvatar.previewUrl, crop: pendingAvatar.crop }
      : profile?.avatarUrl
        ? { url: profile.avatarUrl, crop: profile.avatarCrop ?? FULL_CROP }
        : null
    : profile?.avatarUrl
      ? { url: profile.avatarUrl, crop: profile.avatarCrop ?? FULL_CROP }
      : null;

  return (
    <RequireAuth>
      <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Header />

        <main className="mx-auto max-w-2xl px-4 py-6">
          <div className="mb-4 flex items-center gap-2">
            <h1 className="text-lg font-bold">My Profile</h1>
            {!editing && profile && (
              <button
                type="button"
                onClick={startEditing}
                aria-label="Edit profile"
                title="Edit profile"
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-teal-600 dark:hover:bg-slate-800 dark:hover:text-teal-400"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                  <path
                    d="M4 20h4l10.5-10.5a2.12 2.12 0 00-3-3L5 17v3z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>

          {loadError && <p className="mb-3 text-sm text-rose-600 dark:text-rose-400">{loadError}</p>}

          {!profile ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              {/* identity — centered */}
              <div className="flex flex-col items-center text-center">
                <div className="relative shrink-0">
                  {currentAvatar ? (
                    <div
                      className="h-36 w-36 rounded-full"
                      style={coverStyle(currentAvatar.url, currentAvatar.crop)}
                    />
                  ) : (
                    <DefaultAvatarIcon size={144} />
                  )}

                  {editing && (
                    <>
                      <button
                        type="button"
                        onClick={() => setAvatarMenuOpen(true)}
                        className="absolute inset-0 grid place-items-center rounded-full bg-slate-900/0 text-xs font-medium text-white opacity-0 transition hover:bg-slate-900/40 hover:opacity-100"
                      >
                        Change
                      </button>

                      {avatarMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={closeAvatarMenu} />
                          <div className="absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
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
                                {currentAvatar && (
                                  <button type="button" onClick={cropCurrent} className={menuItem}>
                                    Crop &amp; zoom
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeAvatarMenu();
                                    fileInputRef.current?.click();
                                  }}
                                  className={menuItem}
                                >
                                  Upload image
                                </button>
                                <button type="button" onClick={() => setLinkMode(true)} className={menuItem}>
                                  Embed image URL
                                </button>
                                {currentAvatar && (
                                  <button
                                    type="button"
                                    onClick={removeAvatar}
                                    className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                  >
                                    Remove photo
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
                    </>
                  )}
                </div>

                {editing ? (
                  <>
                    <label className="mt-4 block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Username
                    </label>
                    <input
                      value={draftUsername}
                      onChange={(e) => setDraftUsername(e.target.value)}
                      maxLength={50}
                      className="mt-1 w-full max-w-xs rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center text-sm outline-none transition focus:border-teal-400 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </>
                ) : (
                  <>
                    <h2 className="mt-3 truncate text-xl font-bold text-slate-900 dark:text-slate-100">
                      {profile.username}
                    </h2>
                    <p className="truncate text-sm text-slate-400">{profile.email}</p>
                  </>
                )}
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                    <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  {formatJoinDate(profile.createdAt)}
                </p>
              </div>

              {/* bio */}
              <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Bio</label>
                {editing ? (
                  <textarea
                    rows={4}
                    value={draftBio}
                    onChange={(e) => setDraftBio(e.target.value)}
                    placeholder="Tell people a bit about yourself…"
                    maxLength={280}
                    className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-400 dark:border-slate-700 dark:bg-slate-800"
                  />
                ) : (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {profile.bio || <span className="text-slate-400">No bio yet.</span>}
                  </p>
                )}
              </div>

              {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

              {editing && (
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={!draftUsername.trim() || saving}
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
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {avatarEditing && (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-slate-900/40 p-4 backdrop-blur-sm sm:place-items-center"
          onClick={discardAvatarEditing}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Zoom &amp; crop your photo
              </h3>
              <button
                type="button"
                onClick={discardAvatarEditing}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="mt-3">
              <ImageCropper
                file={avatarEditing.kind === "file" ? avatarEditing.file : undefined}
                imageUrl={avatarEditing.kind !== "file" ? avatarEditing.url : undefined}
                initialCrop={avatarEditing.initialCrop}
                aspect={1}
                cropShape="round"
                onCropChange={setPendingCrop}
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={discardAvatarEditing}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyAvatarCrop}
                disabled={!pendingCrop}
                className="rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </RequireAuth>
  );
}
