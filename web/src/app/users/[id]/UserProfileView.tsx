"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import DefaultAvatarIcon from "@/components/DefaultAvatarIcon";
import LoadingState from "@/components/LoadingState";
import { useAuth } from "@/lib/auth";
import { coverStyle } from "@/lib/cover";
import { formatJoinDate } from "@/lib/time";
import { FULL_CROP } from "@/lib/media";
import { getProfile, type Profile } from "@/lib/profile";

type Props = {
  id: string;
  // What the server rendered, or null when it had nothing (missing user, or Core
  // didn't answer in time) — then the browser fetches it instead.
  initial: Profile | null;
};

export default function UserProfileView({ id, initial }: Props) {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [profile, setProfile] = useState<Profile | null | undefined>(initial ?? undefined);

  // Viewing your own profile lives at /profile (the editable version).
  useEffect(() => {
    if (user && id === user.id) {
      router.replace("/profile");
    }
  }, [user, id, router]);

  // Someone else's profile looks the same to every viewer, so a server-rendered one needs
  // no browser fetch at all. Otherwise wait for the session check (your own profile
  // redirects above) and fetch once.
  useEffect(() => {
    if (initial || loading || (user && id === user.id)) return;
    let cancelled = false;
    getProfile(id)
      .then((p) => !cancelled && setProfile(p))
      .catch(() => !cancelled && setProfile(null));
    return () => {
      cancelled = true;
    };
  }, [id, user, loading, initial]);

  return (
    <>
      <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Header />

        <main className="mx-auto max-w-2xl px-4 py-6">
          {profile === undefined ? (
            <LoadingState />
          ) : profile === null ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">User not found.</p>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              {/* identity — centered */}
              <div className="flex flex-col items-center text-center">
                {profile.avatarUrl ? (
                  <div
                    className="h-36 w-36 rounded-full"
                    style={coverStyle(profile.avatarUrl, profile.avatarCrop ?? FULL_CROP)}
                  />
                ) : (
                  <DefaultAvatarIcon size={144} />
                )}

                <h1 className="mt-3 truncate text-xl font-bold text-slate-900 dark:text-slate-100">
                  {profile.username}
                </h1>
                {/* The month can differ between the server's time zone and the browser's. */}
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400" suppressHydrationWarning>
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
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {profile.bio || <span className="text-slate-400">No bio yet.</span>}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
