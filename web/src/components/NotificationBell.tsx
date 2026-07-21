"use client";

import { useState } from "react";
import { formatRelativeTime } from "@/lib/time";

type Notification = {
  id: string;
  actor: string;
  message: string;
  createdAt: string;
  read: boolean;
};

// Mock data — replace with a real feed (poll or WebSocket) once the backend endpoint exists.
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    actor: "Mia Tran",
    message: "liked your post \"Sunday hike notes\"",
    createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    read: false,
  },
  {
    id: "2",
    actor: "Kevin Pham",
    message: "commented: \"This is such a great spot!\"",
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    read: false,
  },
  {
    id: "3",
    actor: "Linh Do",
    message: "added your post to \"Weekend trips\"",
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    read: true,
  },
];

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3a6 6 0 00-6 6v3.5c0 .68-.24 1.34-.68 1.86L4 16h16l-1.32-1.64a2.99 2.99 0 01-.68-1.86V9a6 6 0 00-6-6z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M9.5 19a2.5 2.5 0 005 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <p className="font-semibold text-slate-900 dark:text-slate-100">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs font-medium text-teal-600 hover:underline dark:text-teal-400"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">
                  You&apos;re all caught up.
                </p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" aria-hidden />
                    )}
                    <span className={n.read ? "ml-5" : ""}>
                      <span className="text-sm text-slate-700 dark:text-slate-200">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {n.actor}
                        </span>{" "}
                        {n.message}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
