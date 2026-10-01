// Server half of the profile page: renders a user's public profile (from a short-lived
// shared cache) in the first response, then UserProfileView takes over in the browser.

import { Suspense } from "react";
import type { Metadata } from "next";
import Header from "@/components/Header";
import LoadingState from "@/components/LoadingState";
import { getPublicProfile } from "@/lib/server/publicApi";
import UserProfileView from "./UserProfileView";

type Params = { params: Promise<{ id: string }> };

async function loadPublic(id: string) {
  try {
    return await getPublicProfile(id);
  } catch {
    return null; // Core slow or erroring — the browser will try instead
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const profile = await loadPublic(id);
  if (!profile) return {};

  const title = `${profile.username} — DanNest`;
  const description = profile.bio || `${profile.username}'s nest on DanNest.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: profile.avatarUrl ? [profile.avatarUrl] : undefined,
    },
  };
}

export default function UserProfilePage({ params }: Params) {
  return (
    <Suspense
      fallback={
        <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          <Header />
          <main className="mx-auto max-w-2xl px-4 py-6">
            <LoadingState />
          </main>
        </div>
      }
    >
      <ProfileContent params={params} />
    </Suspense>
  );
}

async function ProfileContent({ params }: Params) {
  const { id } = await params;
  return <UserProfileView id={id} initial={await loadPublic(id)} />;
}
