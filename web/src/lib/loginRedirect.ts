// Round-trips a visitor through /login and back to the page they were on, via a
// `?next=` param. Only same-site paths are honoured, so a crafted link can't use
// the login page to bounce someone off to another site.

/** A safe place to land after login: `value` if it's a same-site path, else home. */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  // Landing back on /login itself would just loop.
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/login/")) {
    return "/";
  }
  return value;
}

/** The login URL that returns to `next` afterwards (plain /login when that's home). */
export function loginUrl(next: string): string {
  const target = safeNext(next);
  return target === "/" ? "/login" : `/login?next=${encodeURIComponent(target)}`;
}

/** The current page's path + query, as `next` for {@link loginUrl}. Browser only. */
export function currentPath(): string {
  return window.location.pathname + window.location.search;
}
