// Server half of the collection page. It renders the anonymous, public view (from a
// short-lived shared cache) so visitors and link previews get real content in the
// first response; CollectionView then takes over in the browser and upgrades it for a
// signed-in viewer. Anything the server can't show (private, members-only, Core down)
// arrives as `initial = null`, and the browser fetches it with the viewer's own token.

import { Suspense } from "react";
import type { Metadata } from "next";
import Header from "@/components/Header";
import LoadingState from "@/components/LoadingState";
import { getPublicCollectionWithPosts } from "@/lib/server/publicApi";
import CollectionView from "./CollectionView";

type Params = { params: Promise<{ id: string }> };

async function loadPublic(id: string) {
  try {
    return await getPublicCollectionWithPosts(id);
  } catch {
    return null; // Core slow or erroring — the browser will try instead
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const data = await loadPublic(id);
  // Nothing public to describe — keep the site defaults rather than hint at what's there.
  if (!data) return {};

  const { collection } = data;
  const title = `${collection.name} — DanNest`;
  const description = collection.description || `A collection by ${collection.ownerUsername} on DanNest.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: collection.coverUrl ? [collection.coverUrl] : undefined,
    },
  };
}

export default function CollectionPage({ params }: Params) {
  return (
    // The fallback is the static shell, sent instantly; the content streams in after it.
    <Suspense
      fallback={
        <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          <Header />
          <main className="mx-auto flex max-w-2xl px-4 py-6">
            <LoadingState />
          </main>
        </div>
      }
    >
      <CollectionContent params={params} />
    </Suspense>
  );
}

async function CollectionContent({ params }: Params) {
  const { id } = await params;
  return <CollectionView id={id} initial={await loadPublic(id)} />;
}
