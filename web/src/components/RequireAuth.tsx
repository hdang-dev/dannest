"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // While checking the session, or when about to redirect, show nothing heavy.
  if (loading || !user) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 text-sm text-slate-400 dark:bg-slate-950">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
