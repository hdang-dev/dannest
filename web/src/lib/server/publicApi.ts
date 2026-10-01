// Server-side reads behind the public pages. The Next server never knows who the
// visitor is (the session lives in the browser), so it always asks Core as an
// anonymous caller — meaning only PUBLIC content can ever land in this shared cache.
//
// Cached per id: served from memory for 60s, refreshed in the background after that,
// and never shown more than 5 minutes old. A miss after the 5 minutes waits on Core.
//
// Server only — don't import this from a client component.

import { cacheLife } from "next/cache";
import { API_URL } from "@/lib/config";
import type { Collection, Page } from "@/lib/collections";
import type { Post } from "@/lib/posts";
import type { Profile } from "@/lib/profile";

// A sleeping Core (Render free tier) can take ~30s to wake. Past this, give up and let
// the browser fetch instead, rather than holding the page's content back that long.
const CORE_TIMEOUT_MS = 8000;

// Must match the collection page's own browser fetch (CollectionView).
const POSTS_PAGE_SIZE = 50;

export type PublicCollectionData = { collection: Collection; posts: Post[] };

/** GET from Core without a token. null on 404 (missing, or not public); throws otherwise. */
async function getAnonymous<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, { signal: AbortSignal.timeout(CORE_TIMEOUT_MS) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Core answered ${res.status} for ${path}`);
  return (await res.json()) as T;
}

/** A public collection and its first page of posts, or null if it isn't public. */
export async function getPublicCollectionWithPosts(id: string): Promise<PublicCollectionData | null> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 300 });

  const safeId = encodeURIComponent(id);
  const [collection, posts] = await Promise.all([
    getAnonymous<Collection>(`/api/v1/collections/${safeId}`),
    getAnonymous<Page<Post>>(`/api/v1/collections/${safeId}/posts?size=${POSTS_PAGE_SIZE}`),
  ]);
  return collection && posts ? { collection, posts: posts.content } : null;
}

/** A user's public profile, or null if there's no such user. */
export async function getPublicProfile(id: string): Promise<Profile | null> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 300 });

  return getAnonymous<Profile>(`/api/v1/users/${encodeURIComponent(id)}`);
}
