// Mock data for the DanNest UI prototype (no backend yet).

export type Author = {
  name: string;
  handle: string;
  from: string; // avatar gradient start
  to: string; // avatar gradient end
};

export type Comment = {
  name: string;
  handle: string;
  from: string;
  to: string;
  time: string;
  text: string;
};

export type Post = {
  id: string;
  author: Author;
  time: string;
  collection: string;
  title: string;
  body: string;
  cover: { from: string; to: string; emoji: string };
  likes: number;
  saves: number;
  comments: Comment[];
  liked?: boolean;
  saved?: boolean;
};

export const currentUser: Author = {
  name: "Dan Huynh",
  handle: "hdang",
  from: "#14b8a6",
  to: "#0891b2",
};

export const posts: Post[] = [
  {
    id: "1",
    author: { name: "Mai Nguyen", handle: "maicollects", from: "#6366f1", to: "#06b6d4" },
    time: "2h",
    collection: "Vintage Cameras",
    title: "Found this 1974 Olympus OM-1 at a flea market",
    body: "Fully mechanical, still fires at every speed. Paid less than a coffee subscription. This is why I never skip a Sunday market. 📷",
    cover: { from: "#78350f", to: "#f59e0b", emoji: "📷" },
    likes: 248,
    saves: 96,
    comments: [
      { name: "Leo Tran", handle: "leobrews", from: "#10b981", to: "#84cc16", time: "1h", text: "Incredible find. The OM-1 shutter feel is unmatched." },
      { name: "Sara Kim", handle: "sarasounds", from: "#8b5cf6", to: "#ec4899", time: "1h", text: "Jealous! Been hunting for one for months." },
    ],
  },
  {
    id: "2",
    author: { name: "Leo Tran", handle: "leobrews", from: "#10b981", to: "#84cc16" },
    time: "5h",
    collection: "Coffee Gear",
    title: "My pour-over setup finally feels complete",
    body: "Switched to a flat-bottom dripper and the clarity is unreal. Adding this to the collection. What's everyone brewing this week?",
    cover: { from: "#3f2d1e", to: "#b45309", emoji: "☕" },
    likes: 512,
    saves: 173,
    saved: true,
    comments: [
      { name: "Dan Huynh", handle: "hdang", from: "#14b8a6", to: "#0891b2", time: "3h", text: "That dripper is on my list. Which grinder are you pairing it with?" },
    ],
  },
  {
    id: "3",
    author: { name: "Sara Kim", handle: "sarasounds", from: "#8b5cf6", to: "#ec4899" },
    time: "8h",
    collection: "Vinyl Records",
    title: "First pressing, still in the sleeve",
    body: "A friend handed me a box of records from their attic. This one made my whole month. Grateful for good friends and good crackle.",
    cover: { from: "#1e1b4b", to: "#7c3aed", emoji: "🎵" },
    likes: 1024,
    saves: 401,
    liked: true,
    comments: [
      { name: "Om Patel", handle: "ompaints", from: "#f43f5e", to: "#f97316", time: "6h", text: "The artwork alone is worth framing." },
      { name: "Mai Nguyen", handle: "maicollects", from: "#6366f1", to: "#06b6d4", time: "5h", text: "First pressings hit different. Congrats!" },
    ],
  },
  {
    id: "4",
    author: { name: "Om Patel", handle: "ompaints", from: "#f43f5e", to: "#f97316" },
    time: "1d",
    collection: "Sketchbooks",
    title: "Filled another one — page 200 of 200",
    body: "Two years, one book. Started as a habit, became a diary. Onto the next. Sharing a few of my favorite spreads soon.",
    cover: { from: "#134e4a", to: "#14b8a6", emoji: "🎨" },
    likes: 767,
    saves: 210,
    comments: [],
  },
];

export type Collection = {
  id: string;
  name: string;
  emoji: string;
  from: string;
  to: string;
  items: number;
  curator: string;
};

export const collections: Collection[] = [
  { id: "c1", name: "Vintage Cameras", emoji: "📷", from: "#f59e0b", to: "#ef4444", items: 42, curator: "maicollects" },
  { id: "c2", name: "Coffee Gear", emoji: "☕", from: "#b45309", to: "#78350f", items: 28, curator: "leobrews" },
  { id: "c3", name: "Vinyl Records", emoji: "🎵", from: "#7c3aed", to: "#ec4899", items: 113, curator: "sarasounds" },
  { id: "c4", name: "Houseplants", emoji: "🪴", from: "#16a34a", to: "#65a30d", items: 19, curator: "hdang" },
  { id: "c5", name: "Keyboards", emoji: "⌨️", from: "#0ea5e9", to: "#6366f1", items: 37, curator: "hdang" },
  { id: "c6", name: "Sketchbooks", emoji: "🎨", from: "#134e4a", to: "#14b8a6", items: 8, curator: "ompaints" },
];
