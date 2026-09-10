import { croppedCoverStyle } from "@/lib/cover";
import type { PostImage } from "@/lib/posts";

/**
 * A single image tile. `tileAspect` is the tile's own width/height ratio — the
 * stored crop (authored at 4:3) is mapped into it without distortion, keeping its
 * zoom and centring the overflow.
 */
function ImageTile({
  image,
  tileAspect,
  className = "",
  overlay,
}: {
  image: PostImage;
  tileAspect: number;
  className?: string;
  overlay?: number;
}) {
  return (
    <div
      className={`relative bg-slate-100 dark:bg-slate-800 ${className}`}
      style={croppedCoverStyle(image.url, image.crop, tileAspect)}
    >
      {overlay ? (
        <div className="absolute inset-0 grid place-items-center bg-black/45 text-2xl font-semibold text-white">
          +{overlay}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Facebook-style image gallery: layout adapts to how many images a post has.
 *
 * `fixed` pins the whole gallery to one 4:3 block edge-to-edge — used by the
 * composer so its photo block never changes size between 0 and N images. The feed
 * (default) lets a lone image keep its natural aspect ratio and uses roomier
 * collage proportions.
 */
export default function PostGallery({
  images,
  fixed = false,
}: {
  images: PostImage[];
  fixed?: boolean;
}) {
  const count = images.length;

  if (count === 0) return null;

  const frame = fixed ? "" : "mx-4";

  if (count === 1) {
    if (fixed) {
      return (
        <div className="aspect-4/3 overflow-hidden rounded-xl">
          <ImageTile image={images[0]} tileAspect={4 / 3} className="h-full w-full" />
        </div>
      );
    }
    // Feed: a lone image keeps its natural aspect ratio, capped at a max height —
    // anything taller is centred and cropped top & bottom rather than squashed.
    return (
      <div className="mx-4 flex max-h-128 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[0].url} alt="" className="w-full" />
      </div>
    );
  }

  if (count === 2) {
    // fixed: two 2:3 halves of the 4:3 block · feed: two squares
    const tileAspect = fixed ? 2 / 3 : 1;
    return (
      <div
        className={`${frame} grid grid-cols-2 gap-1 overflow-hidden rounded-xl ${fixed ? "aspect-4/3" : "aspect-2/1"}`}
      >
        {images.map((img, i) => (
          <ImageTile key={i} image={img} tileAspect={tileAspect} className="h-full w-full" />
        ))}
      </div>
    );
  }

  if (count === 3) {
    // one tall tile + two stacked. Aspects differ per slot.
    const tall = fixed ? 2 / 3 : 0.8;
    const small = fixed ? 4 / 3 : 1.6;
    return (
      <div
        className={`${frame} grid grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-xl ${fixed ? "aspect-4/3" : "aspect-16/10"}`}
      >
        <ImageTile image={images[0]} tileAspect={tall} className="row-span-2 h-full w-full" />
        <ImageTile image={images[1]} tileAspect={small} className="h-full w-full" />
        <ImageTile image={images[2]} tileAspect={small} className="h-full w-full" />
      </div>
    );
  }

  // 4+ → 2×2 grid, with a "+N" overlay on the last tile when there are extras.
  const shown = images.slice(0, 4);
  const extra = count - 4;
  const tileAspect = fixed ? 4 / 3 : 1;
  return (
    <div
      className={`${frame} grid grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-xl ${fixed ? "aspect-4/3" : "aspect-square"}`}
    >
      {shown.map((img, i) => (
        <ImageTile
          key={i}
          image={img}
          tileAspect={tileAspect}
          className="h-full w-full"
          overlay={i === 3 && extra > 0 ? extra : undefined}
        />
      ))}
    </div>
  );
}
