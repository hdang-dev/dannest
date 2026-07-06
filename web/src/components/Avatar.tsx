type Props = {
  name: string;
  from: string;
  to: string;
  size?: number;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Avatar({ name, from, to, size = 40 }: Props) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm ring-2 ring-white dark:ring-slate-900"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, ${from}, ${to})`,
      }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
