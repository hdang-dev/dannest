// Runs once per Next.js server instance, before it starts serving requests.
// On Render free tier that's exactly the moment web itself wakes from sleep —
// so this is the earliest possible point to start waking core, marketplace,
// and notification too, overlapping their cold start with web's own boot
// instead of waiting for the first user action that happens to need them.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { HEALTH_ENDPOINTS } = await import("@/lib/config");
  for (const { url } of HEALTH_ENDPOINTS) {
    fetch(url, { cache: "no-store" }).catch(() => {});
  }
}
