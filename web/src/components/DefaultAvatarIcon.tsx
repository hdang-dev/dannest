type Props = { size?: number };

/** Generic human silhouette shown when a user has no uploaded/embedded avatar. */
export default function DefaultAvatarIcon({ size = 96 }: Props) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: size * 0.55, height: size * 0.55 }}>
        <path d="M12 12a5 5 0 100-10 5 5 0 000 10zM4 22a8 8 0 1116 0v.5a.5.5 0 01-.5.5h-15a.5.5 0 01-.5-.5V22z" />
      </svg>
    </div>
  );
}
