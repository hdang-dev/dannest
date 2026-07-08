"use client";

import { useEffect, useRef } from "react";
import { GOOGLE_CLIENT_ID } from "@/lib/config";
import { useAuth } from "@/lib/auth";

const GSI_SRC = "https://accounts.google.com/gsi/client";

function loadGsi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const s = document.createElement("script");
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(s);
  });
}

export default function GoogleSignIn() {
  const { loginWithGoogle } = useAuth();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return; // not configured yet
    let cancelled = false;
    loadGsi().then(() => {
      if (cancelled || !ref.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          loginWithGoogle(response.credential).catch(() => {
            /* surfaced elsewhere; keep the button usable */
          });
        },
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signin_with",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [loginWithGoogle]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <span className="rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-400 dark:border-slate-700">
        Set NEXT_PUBLIC_GOOGLE_CLIENT_ID
      </span>
    );
  }
  return <div ref={ref} className="min-h-[40px]" />;
}
