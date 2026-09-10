"use client";

import DefaultAvatarIcon from "./DefaultAvatarIcon";
import { coverStyle } from "@/lib/cover";
import { FULL_CROP } from "@/lib/media";
import { useAuth } from "@/lib/auth";

// Inline "start a post" trigger — sits at the top of a feed the user can post to
// and opens the composer. Replaces the floating action button.
export default function StartPostBar({
  onClick,
  label = "What's worth sharing today?",
}: {
  onClick: () => void;
  label?: string;
}) {
  const { user } = useAuth();

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      {user?.avatarUrl ? (
        <div
          className="h-9 w-9 shrink-0 rounded-full"
          style={coverStyle(user.avatarUrl, user.avatarCrop ?? FULL_CROP)}
        />
      ) : (
        <DefaultAvatarIcon size={36} />
      )}
      <span className="flex-1 truncate rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {label}
      </span>
      <span className="grid h-9 w-9 shrink-0 place-items-center text-teal-600 dark:text-teal-400">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="1.6" />
          <path d="m21 15-4.5-4.5L6 21" />
        </svg>
      </span>
    </button>
  );
}
