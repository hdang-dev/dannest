"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { coverStyle } from "@/lib/cover";
import { FULL_CROP } from "@/lib/media";
import DefaultAvatarIcon from "./DefaultAvatarIcon";

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        className="block rounded-full ring-2 ring-transparent transition hover:ring-teal-400"
      >
        {user.avatarUrl ? (
          <div
            className="h-9 w-9 rounded-full"
            style={coverStyle(user.avatarUrl, user.avatarCrop ?? FULL_CROP)}
          />
        ) : (
          <DefaultAvatarIcon size={36} />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                {user.username}
              </p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="block border-b border-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Profile
            </Link>
            <Link
              href="/my-collections"
              onClick={() => setOpen(false)}
              className="block border-b border-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              My Collections
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full px-4 py-2.5 text-left text-sm font-medium text-rose-600 transition hover:bg-slate-100 dark:text-rose-400 dark:hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
