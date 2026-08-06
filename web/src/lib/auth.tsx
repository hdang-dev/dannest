"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "./config";
import { refreshSession, setUnauthorizedHandler } from "./api";
import { clearToken, getToken, setToken } from "./token";
import type { Crop } from "./media";

// `avatarUrl`/`avatarCrop` are the user's own uploaded/embedded photo (backed by a
// Media asset) — never the Google OAuth picture.
export type AuthUser = {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  avatarCrop: Crop | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
  /** Patch the in-memory user (e.g. after a profile edit) without a full re-fetch. */
  updateUser: (patch: Partial<AuthUser>) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Re-export so existing imports of getToken keep working.
export { getToken };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const logout = useCallback(() => {
    // Best-effort: revoke the refresh token server-side (Redis) so it can't be
    // used again, but the client-side session ends either way.
    fetch(`${API_URL}/api/v1/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    clearToken();
    setUser(null);
    window.google?.accounts?.id?.disableAutoSelect?.();
  }, []);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((cur) => (cur ? { ...cur, ...patch } : cur));
  }, []);

  // Any API call that returns 401 (expired / invalid token) ends the session and
  // sends the user to login — so the app never gets stuck silently failing.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken();
      setUser(null);
      if (window.location.pathname !== "/login") {
        router.replace("/login");
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  // The access token lives in memory only, so it's gone on every reload — restore
  // the session by exchanging the httpOnly refresh cookie for a new one instead.
  // This MUST go through the shared refreshSession() (not its own fetch): the
  // refresh token is single-use, so a second, uncoordinated caller racing this
  // one would consume it first and log the user right back out.
  useEffect(() => {
    let cancelled = false;

    refreshSession().then((data) => {
      if (cancelled) return;
      if (data) setUser(data.user as AuthUser);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const res = await fetch(`${API_URL}/api/v1/auth/google`, {
      method: "POST",
      credentials: "include", // receive the refresh-token cookie
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      throw new Error("Google sign-in failed");
    }
    const data = await res.json();
    setToken(data.accessToken);
    setUser(data.user);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
