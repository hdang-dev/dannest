"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import GoogleSignIn from "@/components/GoogleSignIn";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Once authenticated (either restored or just signed in), leave for home.
  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Dan<span className="text-teal-600 dark:text-teal-400">Nest</span>
        </h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Collect what you love. Sign in to get started.
        </p>

        <div className="mt-8 flex justify-center">
          {user ? (
            <span className="text-sm text-slate-400">Signing you in…</span>
          ) : (
            <GoogleSignIn />
          )}
        </div>
      </main>
    </div>
  );
}
