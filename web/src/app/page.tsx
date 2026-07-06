import Header from "@/components/Header";
import CollectionsStrip from "@/components/CollectionsStrip";
import PostCard from "@/components/PostCard";
import NewPostFab from "@/components/NewPostFab";
import { posts } from "@/lib/mock";

export default function Home() {
  return (
    <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">
        <CollectionsStrip />

        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </main>

      <NewPostFab />
    </div>
  );
}
