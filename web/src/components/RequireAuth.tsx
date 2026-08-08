"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import LoadingState from "./LoadingState";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // While checking the session, or when about to redirect, show nothing heavy.
  if (loading || !user) {
    return (
      <div className="flex min-h-full bg-slate-50 dark:bg-slate-950">
        <LoadingState minHeight="100dvh" />
      </div>
    );
  }

  return <>{children}</>;
}
