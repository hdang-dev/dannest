import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to THIS app's folder.
  // Otherwise Next.js walks up the filesystem looking for a lockfile and can
  // latch onto a stray one (e.g. ~/package-lock.json), which breaks module
  // resolution and caching. apps/web is self-contained, so its own dir is root.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
