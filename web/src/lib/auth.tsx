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
import { setUnauthorizedHandler } from "./api";
import { clearToken, getToken, setToken } from "./token";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Re-export so existing imports of getToken keep working.
export { getToken };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    window.google?.accounts?.id?.disableAutoSelect?.();
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

  // Restore the session from a stored token on first load.
  useEffect(() => {
    let cancelled = false;
    const token = getToken();

    const request: Promise<AuthUser | null> = token
      ? fetch(`${API_URL}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => {
            if (res.ok) return res.json() as Promise<AuthUser>;
            clearToken(); // stale token — drop it; RequireAuth will route to login
            return null;
          })
          .catch(() => null)
      : Promise.resolve(null);

    request.then((restored) => {
      if (cancelled) return;
      if (restored) setUser(restored);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const res = await fetch(`${API_URL}/api/v1/auth/google`, {
      method: "POST",
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
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
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
