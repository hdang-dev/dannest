"use client";

// Public pages are read-only for visitors who aren't signed in. Any action that needs
// an account (like, follow, comment, reply) calls requireLogin() first: signed in, it
// returns true and the action goes ahead; otherwise it opens a friendly "sign in first"
// dialog and returns false. "Sign in" goes to /login and comes back to this same page.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useAuth } from "./auth";
import { currentPath, loginUrl } from "./loginRedirect";

type RequireLogin = () => boolean;

const SignInPromptContext = createContext<RequireLogin | undefined>(undefined);

export function SignInPromptProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const requireLogin = useCallback(() => {
    if (user) return true;
    // Still restoring the session — this visitor may well be signed in, so don't
    // nag them; the click just does nothing for that brief moment.
    if (!loading) setOpen(true);
    return false;
  }, [user, loading]);

  return (
    <SignInPromptContext.Provider value={requireLogin}>
      {children}
      {open && (
        <ConfirmDialog
          title="Hop into the nest first 🪺"
          message="Sign in to like, follow, and chat about the things you love — it's one tap with Google, and we'll bring you right back here."
          confirmLabel="Sign in"
          cancelLabel="Just browsing"
          onConfirm={() => {
            setOpen(false);
            router.push(loginUrl(currentPath()));
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </SignInPromptContext.Provider>
  );
}

export function useRequireLogin(): RequireLogin {
  const ctx = useContext(SignInPromptContext);
  if (!ctx) {
    throw new Error("useRequireLogin must be used within SignInPromptProvider");
  }
  return ctx;
}
