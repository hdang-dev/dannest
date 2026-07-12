"use client";

// Floating "new post" button. The composer modal itself is owned by the page (so it
// can also be opened in edit mode from a post's ⋯ menu), so this is just a trigger.
export default function NewPostFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="New post"
      className="fixed bottom-6 right-6 z-30 grid h-14 w-14 place-items-center rounded-full bg-teal-600 text-white shadow-lg transition hover:bg-teal-500 hover:shadow-xl active:scale-95"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
