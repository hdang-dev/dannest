// Shared page/section loading placeholder — a centered spinner instead of top-aligned text.
// `minHeight` sizes the centering box: the full "50vh" default suits a page that's
// otherwise empty; a smaller value fits better below content that's already loaded
// (e.g. a collection's posts, once its header banner is already showing).
export default function LoadingState({ className = "", minHeight = "50vh" }: { className?: string; minHeight?: string }) {
  return (
    <div className={`flex flex-1 items-center justify-center ${className}`} style={{ minHeight }}>
      <svg
        className="h-7 w-7 animate-spin text-slate-300 dark:text-slate-600"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        role="status"
        aria-label="Loading"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  );
}
