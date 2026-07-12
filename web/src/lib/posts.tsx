"use client";

// Self-contained, client-side MOCK of the Post lifecycle — no backend.
// Seeds a small world of collections + posts and exposes create / edit /
// archive(hide) / unarchive / like actions so the full flow is clickable.
// (Comments are shown read-only for now; the compose flow comes later.)

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PostVisibility = "PUBLIC" | "PRIVATE";

export type PersonRef = { name: string; handle: string; from: string; to: string };

export type MockComment = { id: string; author: PersonRef; time: string; text: string };

export type MockCollection = {
  id: string;
  name: string;
  emoji: string;
  visibility: PostVisibility;
  mine: boolean;
  archived: boolean;
};

/**
 * A post image. `url` is a real uploaded/preview image (data URL in this mock); when
 * absent it falls back to the gradient + emoji stand-in used by the seeded posts.
 */
export type Cover = { from: string; to: string; emoji: string; url?: string };

export type Post = {
  id: string;
  author: PersonRef;
  collectionId: string;
  title: string;
  body: string;
  /** First image — kept as the single "cover" for collection thumbnails etc. */
  cover: Cover;
  /** All attached images, Facebook-style. Falls back to `[cover]` when absent. */
  images?: Cover[];
  visibility: PostVisibility;
  likes: number;
  liked: boolean;
  comments: MockComment[];
  archived: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO — newer than createdAt once edited
};

/** The signed-in identity for this mock — used to decide which posts/collections you own. */
export const currentUser: PersonRef = {
  name: "Dan Huynh",
  handle: "hdang",
  from: "#14b8a6",
  to: "#0891b2",
};

/** Cover presets for the composer (gradient + a fitting emoji). */
export const COVER_PALETTE: Cover[] = [
  { from: "#78350f", to: "#f59e0b", emoji: "📷" },
  { from: "#3f2d1e", to: "#b45309", emoji: "☕" },
  { from: "#1e1b4b", to: "#7c3aed", emoji: "🎵" },
  { from: "#134e4a", to: "#14b8a6", emoji: "🪴" },
  { from: "#0ea5e9", to: "#6366f1", emoji: "⌨️" },
  { from: "#be123c", to: "#f97316", emoji: "🎨" },
  { from: "#065f46", to: "#84cc16", emoji: "🌿" },
  { from: "#7c2d12", to: "#ea580c", emoji: "🍜" },
];

const seedCollections: MockCollection[] = [
  { id: "c1", name: "Vintage Cameras", emoji: "📷", visibility: "PUBLIC", mine: false, archived: false },
  { id: "c2", name: "Coffee Gear", emoji: "☕", visibility: "PUBLIC", mine: true, archived: false },
  { id: "c3", name: "Vinyl Records", emoji: "🎵", visibility: "PUBLIC", mine: false, archived: false },
  { id: "c4", name: "Houseplants", emoji: "🪴", visibility: "PUBLIC", mine: true, archived: false },
  { id: "c5", name: "Sketchbooks", emoji: "🎨", visibility: "PRIVATE", mine: true, archived: false },
];

const mai: PersonRef = { name: "Mai Nguyen", handle: "maicollects", from: "#6366f1", to: "#06b6d4" };
const leo: PersonRef = { name: "Leo Tran", handle: "leobrews", from: "#10b981", to: "#84cc16" };
const sara: PersonRef = { name: "Sara Kim", handle: "sarasounds", from: "#8b5cf6", to: "#ec4899" };

// Seed timestamps are relative to load time so relative labels stay sensible.
// (Post cards only render client-side — RequireAuth shows a loader during SSR —
// so there's no hydration mismatch from time formatting.)
const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();

const seedPosts: Post[] = [
  {
    id: "p1",
    author: mai,
    collectionId: "c1",
    title: "Found this 1974 Olympus OM-1 at a flea market",
    body: "Fully mechanical, still fires at every speed. Paid less than a coffee subscription. This is why I never skip a Sunday market. 📷",
    cover: { from: "#78350f", to: "#f59e0b", emoji: "📷" },
    images: [
      { from: "#78350f", to: "#f59e0b", emoji: "📷" },
      { from: "#3f2d1e", to: "#b45309", emoji: "🎞️" },
    ],
    visibility: "PUBLIC",
    likes: 248,
    liked: false,
    archived: false,
    createdAt: hoursAgo(2),
    updatedAt: hoursAgo(2),
    comments: [
      { id: "p1c1", author: leo, time: "1h ago", text: "Incredible find. The OM-1 shutter feel is unmatched." },
      { id: "p1c2", author: sara, time: "1h ago", text: "Jealous! Been hunting for one for months." },
    ],
  },
  {
    id: "p2",
    author: leo,
    collectionId: "c2",
    title: "My pour-over setup finally feels complete",
    body: "Switched to a flat-bottom dripper and the clarity is unreal. Adding this to the collection. What's everyone brewing this week?",
    cover: { from: "#3f2d1e", to: "#b45309", emoji: "☕" },
    visibility: "PUBLIC",
    likes: 512,
    liked: false,
    archived: false,
    createdAt: hoursAgo(5),
    updatedAt: hoursAgo(5),
    comments: [
      { id: "p2c1", author: currentUser, time: "3h ago", text: "That dripper is on my list. Which grinder are you pairing it with?" },
    ],
  },
  {
    id: "p3",
    author: sara,
    collectionId: "c3",
    title: "First pressing, still in the sleeve",
    body: "A friend handed me a box of records from their attic. This one made my whole month. Grateful for good friends and good crackle.",
    cover: { from: "#1e1b4b", to: "#7c3aed", emoji: "🎵" },
    images: [
      { from: "#1e1b4b", to: "#7c3aed", emoji: "🎵" },
      { from: "#312e81", to: "#a855f7", emoji: "💿" },
      { from: "#4c1d95", to: "#ec4899", emoji: "🎧" },
    ],
    visibility: "PUBLIC",
    likes: 1024,
    liked: true,
    archived: false,
    createdAt: hoursAgo(8),
    updatedAt: hoursAgo(8),
    comments: [
      { id: "p3c1", author: mai, time: "5h ago", text: "First pressings hit different. Congrats!" },
    ],
  },
  {
    id: "p4",
    author: currentUser,
    collectionId: "c4",
    title: "Repotted the monstera — new leaf incoming",
    body: "Third fenestrated leaf this season. The self-watering pot changed everything. Sharing the soil mix in the comments soon.",
    cover: { from: "#134e4a", to: "#14b8a6", emoji: "🪴" },
    images: [
      { from: "#134e4a", to: "#14b8a6", emoji: "🪴" },
      { from: "#065f46", to: "#84cc16", emoji: "🌿" },
      { from: "#166534", to: "#4ade80", emoji: "🍃" },
      { from: "#3f6212", to: "#a3e635", emoji: "🌱" },
      { from: "#14532d", to: "#22c55e", emoji: "☘️" },
    ],
    visibility: "PUBLIC",
    likes: 87,
    liked: false,
    archived: false,
    createdAt: hoursAgo(26),
    updatedAt: hoursAgo(0.3), // edited ~20 min ago
    comments: [],
  },
  {
    id: "p5",
    author: currentUser,
    collectionId: "c2",
    title: "Draft: tasting notes for the new Ethiopia lot",
    body: "Blueberry up front, tea-like finish. Keeping this private until I dial in the recipe — not ready to share the ratios yet.",
    cover: { from: "#7c2d12", to: "#ea580c", emoji: "🍜" },
    visibility: "PRIVATE",
    likes: 0,
    liked: false,
    archived: false,
    createdAt: hoursAgo(48),
    updatedAt: hoursAgo(48),
    comments: [],
  },
  {
    id: "p6",
    author: currentUser,
    collectionId: "c5",
    title: "Old sketch I archived while cleaning up",
    body: "Not my best work — hiding it from the feed but keeping it around. This is what archive/hide looks like.",
    cover: { from: "#be123c", to: "#f97316", emoji: "🎨" },
    visibility: "PUBLIC",
    likes: 12,
    liked: false,
    archived: true,
    createdAt: hoursAgo(21 * 24),
    updatedAt: hoursAgo(21 * 24),
    comments: [],
  },
];

// ---------------------------------------------------------------------------
// Random (but stable) mock posts for a collection. Real collections have UUID ids
// that the seed posts above don't match, so a collection's detail feed would be
// empty — this fills it with believable posts derived deterministically from the
// collection id (same id → same posts across renders).
// ---------------------------------------------------------------------------

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 — a tiny deterministic PRNG so the same seed yields the same posts. */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MOCK_PEOPLE: PersonRef[] = [
  currentUser,
  { name: "Mai Nguyen", handle: "maicollects", from: "#6366f1", to: "#06b6d4" },
  { name: "Leo Tran", handle: "leobrews", from: "#10b981", to: "#84cc16" },
  { name: "Sara Kim", handle: "sarasounds", from: "#8b5cf6", to: "#ec4899" },
  { name: "Priya Rao", handle: "priyamakes", from: "#f43f5e", to: "#f59e0b" },
  { name: "Kenji Ito", handle: "kenjishoots", from: "#0ea5e9", to: "#6366f1" },
];

const MOCK_TITLES = [
  "Finally added this one to the shelf",
  "Weekend find I couldn't pass up",
  "This has been my favorite lately",
  "Little upgrade to the setup",
  "Been meaning to share this for a while",
  "Not my usual pick, but I love it",
  "A small one, but it made my day",
  "Restored this over the weekend",
  "New addition to the collection",
  "Couldn't resist this at the market",
];

const MOCK_BODIES = [
  "Took a while to track down, but so worth it. Sharing it here before it goes on the shelf.",
  "Still can't believe the condition. Whoever had it before took great care of it.",
  "Paid less than I expected. Sometimes patience really does pay off.",
  "The details on this one are unreal in person. Photos don't quite do it justice.",
  "Adding it to the collection and calling it a good week. What do you all think?",
  "A friend tipped me off about this. Grateful for people who know my taste.",
  "",
];

const MOCK_COMMENTS = [
  "This is gorgeous — congrats on the find!",
  "Okay I'm officially jealous.",
  "Where did you track this down??",
  "The condition is unreal. Nice one.",
  "Adding this to my wishlist immediately.",
  "Love it. Great addition to the collection.",
];

/** A stable, random-looking set of mock posts for a collection id. */
export function generateMockPosts(collectionId: string): Post[] {
  const rand = seededRandom(hashString(collectionId));
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  const count = 4 + Math.floor(rand() * 4); // 4..7 posts
  const posts: Post[] = [];

  for (let i = 0; i < count; i++) {
    const imageCount = 1 + Math.floor(rand() * 5); // 1..5 images
    const images: Cover[] = Array.from({ length: imageCount }, () => pick(COVER_PALETTE));
    const commentCount = Math.floor(rand() * 3); // 0..2 comments
    const comments: MockComment[] = Array.from({ length: commentCount }, (_, ci) => ({
      id: `${collectionId}-p${i}-c${ci}`,
      author: pick(MOCK_PEOPLE),
      time: `${1 + Math.floor(rand() * 20)}h ago`,
      text: pick(MOCK_COMMENTS),
    }));
    const createdAt = new Date(now - Math.floor(rand() * 240) * 3_600_000).toISOString();

    posts.push({
      id: `${collectionId}-p${i}`,
      author: pick(MOCK_PEOPLE),
      collectionId,
      title: pick(MOCK_TITLES),
      body: pick(MOCK_BODIES),
      cover: images[0],
      images,
      visibility: "PUBLIC",
      likes: Math.floor(rand() * 900),
      liked: rand() < 0.3,
      comments,
      archived: false,
      createdAt,
      updatedAt: createdAt,
    });
  }

  // Newest first, matching the real feed order.
  return posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type CreatePostInput = {
  collectionId: string;
  title: string;
  body: string;
  cover: Cover;
  /** Optional extra images. When omitted the post shows just the cover. */
  images?: Cover[];
  visibility: PostVisibility;
};

export type UpdatePostInput = Partial<CreatePostInput>;

export type UpdateCollectionInput = Partial<Pick<MockCollection, "name" | "emoji" | "visibility">>;

type PostsContextValue = {
  posts: Post[];
  collections: MockCollection[];
  currentUser: PersonRef;
  createPost: (input: CreatePostInput) => Post;
  updatePost: (id: string, patch: UpdatePostInput) => void;
  archivePost: (id: string) => void;
  unarchivePost: (id: string) => void;
  toggleLike: (id: string) => void;
  isOwnedByMe: (post: Post) => boolean;
  collectionFor: (id: string) => MockCollection | undefined;
  updateCollection: (id: string, patch: UpdateCollectionInput) => void;
  archiveCollection: (id: string) => void;
};

const PostsContext = createContext<PostsContextValue | undefined>(undefined);

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return "id" + Math.floor(performance.now() * 1000).toString(36);
  }
}

export function PostsProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<Post[]>(seedPosts);
  const [collections, setCollections] = useState<MockCollection[]>(seedCollections);

  const createPost = useCallback((input: CreatePostInput): Post => {
    const stamp = new Date().toISOString();
    const post: Post = {
      id: newId(),
      author: currentUser,
      collectionId: input.collectionId,
      title: input.title,
      body: input.body,
      cover: input.cover,
      images: input.images?.length ? input.images : [input.cover],
      visibility: input.visibility,
      likes: 0,
      liked: false,
      comments: [],
      archived: false,
      createdAt: stamp,
      updatedAt: stamp,
    };
    setPosts((cur) => [post, ...cur]);
    return post;
  }, []);

  const updatePost = useCallback((id: string, patch: UpdatePostInput) => {
    setPosts((cur) =>
      cur.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)),
    );
  }, []);

  const archivePost = useCallback((id: string) => {
    setPosts((cur) => cur.map((p) => (p.id === id ? { ...p, archived: true } : p)));
  }, []);

  const unarchivePost = useCallback((id: string) => {
    setPosts((cur) => cur.map((p) => (p.id === id ? { ...p, archived: false } : p)));
  }, []);

  const toggleLike = useCallback((id: string) => {
    setPosts((cur) =>
      cur.map((p) =>
        p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p,
      ),
    );
  }, []);

  const isOwnedByMe = useCallback(
    (post: Post) => post.author.handle === currentUser.handle,
    [],
  );

  const collectionFor = useCallback(
    (id: string) => collections.find((c) => c.id === id),
    [collections],
  );

  const updateCollection = useCallback((id: string, patch: UpdateCollectionInput) => {
    setCollections((cur) => cur.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const archiveCollection = useCallback((id: string) => {
    setCollections((cur) => cur.map((c) => (c.id === id ? { ...c, archived: true } : c)));
  }, []);

  const value = useMemo<PostsContextValue>(
    () => ({
      posts,
      collections,
      currentUser,
      createPost,
      updatePost,
      archivePost,
      unarchivePost,
      toggleLike,
      isOwnedByMe,
      collectionFor,
      updateCollection,
      archiveCollection,
    }),
    [
      posts,
      collections,
      createPost,
      updatePost,
      archivePost,
      unarchivePost,
      toggleLike,
      isOwnedByMe,
      collectionFor,
      updateCollection,
      archiveCollection,
    ],
  );

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}

export function usePosts(): PostsContextValue {
  const ctx = useContext(PostsContext);
  if (!ctx) throw new Error("usePosts must be used within PostsProvider");
  return ctx;
}
