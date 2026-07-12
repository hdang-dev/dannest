import { coverStyle } from "@/lib/cover";
import type { PostImage } from "@/lib/posts";

/** A single image tile — a real photo with its stored display crop. */
function ImageTile({
  image,
  className = "",
  overlay,
}: {
  image: PostImage;
  className?: string;
  overlay?: number;
}) {
  return (
    <div
      className={`relative bg-slate-100 dark:bg-slate-800 ${className}`}
      style={coverStyle(image.url, image.crop)}
    >
      {overlay ? (
        <div className="absolute inset-0 grid place-items-center bg-black/45 text-2xl font-semibold text-white">
          +{overlay}
        </div>
      ) : null}
    </div>
  );
}

/** Facebook-style image gallery: layout adapts to how many images a post has. */
export default function PostGallery({ images }: { images: PostImage[] }) {
  const count = images.length;

  if (count === 0) return null;

  if (count === 1) {
    return (
      <div className="mx-4 overflow-hidden rounded-xl">
        <ImageTile image={images[0]} className="h-64" />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="mx-4 grid grid-cols-2 gap-1 overflow-hidden rounded-xl">
        {images.map((img, i) => (
          <ImageTile key={i} image={img} className="h-52" />
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="mx-4 grid h-64 grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-xl">
        <ImageTile image={images[0]} className="row-span-2 h-full" />
        <ImageTile image={images[1]} className="h-full" />
        <ImageTile image={images[2]} className="h-full" />
      </div>
    );
  }

  // 4+ → 2×2 grid, with a "+N" overlay on the last tile when there are extras.
  const shown = images.slice(0, 4);
  const extra = count - 4;
  return (
    <div className="mx-4 grid grid-cols-2 gap-1 overflow-hidden rounded-xl">
      {shown.map((img, i) => (
        <ImageTile
          key={i}
          image={img}
          className="h-40"
          overlay={i === 3 && extra > 0 ? extra : undefined}
        />
      ))}
    </div>
  );
}
