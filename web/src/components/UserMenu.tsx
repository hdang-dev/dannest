"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";

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
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.username}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-600 font-semibold text-white">
            {user.username.charAt(0).toUpperCase()}
          </span>
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
