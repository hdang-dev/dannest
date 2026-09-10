// Renders a cover image with its stored crop applied purely in CSS — no re-encoding,
// no CORS needed (works for uploaded and external images alike).
//
// The crop is a rectangle (fractions 0..1) of the image, constrained at crop time to
// the cover aspect ratio, so containers using that same ratio show it without distortion.

import type { CSSProperties } from "react";
import type { Crop } from "./media";

/** Every place a cover is shown uses this aspect (matches the cropper). */
export const COVER_ASPECT = "16 / 10";

export function coverStyle(url: string | null, crop?: Crop | null): CSSProperties {
  if (!url) return {};
  const bg: CSSProperties = {
    backgroundImage: `url("${url}")`,
    backgroundRepeat: "no-repeat",
  };
  // Full image (or no crop) → plain cover/center.
  if (!crop || (crop.width >= 0.999 && crop.height >= 0.999)) {
    return { ...bg, backgroundSize: "cover", backgroundPosition: "center" };
  }
  const sizeX = 100 / crop.width;
  const sizeY = 100 / crop.height;
  const posX = crop.width < 1 ? (crop.x / (1 - crop.width)) * 100 : 0;
  const posY = crop.height < 1 ? (crop.y / (1 - crop.height)) * 100 : 0;
  return {
    ...bg,
    backgroundSize: `${sizeX}% ${sizeY}%`,
    backgroundPosition: `${posX}% ${posY}%`,
  };
}

/**
 * Show `crop` (authored at `cropAspect`) inside a tile of a *different* aspect
 * ratio (`tileAspect`) without ever distorting the photo: the crop region fills
 * whichever tile axis it can, keeps its zoom, and the overflow is centred on the
 * crop. Falls back to a plain cover for un-cropped images.
 *
 * When `tileAspect === cropAspect` this is exactly {@link coverStyle}; it only
 * diverges when the tile is a different shape (2×2 collage cells, side-by-side
 * pairs, the tall tile in a 3-up).
 */
export function croppedCoverStyle(
  url: string | null,
  crop: Crop | null | undefined,
  tileAspect: number,
  cropAspect = 4 / 3,
): CSSProperties {
  if (!url) return {};
  const bg: CSSProperties = { backgroundImage: `url("${url}")`, backgroundRepeat: "no-repeat" };
  if (!crop || (crop.width >= 0.999 && crop.height >= 0.999)) {
    return { ...bg, backgroundSize: "cover", backgroundPosition: "center" };
  }
  const pct = (n: number) => `${Math.min(Math.max(n, 0), 100)}%`;

  if (tileAspect >= cropAspect) {
    // The crop spans the tile's width; it overflows vertically — frame its centre.
    const k = (cropAspect * crop.height) / tileAspect; // tile height ÷ scaled image height
    const cy = crop.y + crop.height / 2;
    const posY = k < 1 ? ((cy - k / 2) / (1 - k)) * 100 : 50;
    const posX = crop.width < 0.999 ? (crop.x / (1 - crop.width)) * 100 : 0;
    return {
      ...bg,
      backgroundSize: `${100 / crop.width}% auto`,
      backgroundPosition: `${pct(posX)} ${pct(posY)}`,
    };
  }
  // The crop spans the tile's height; it overflows horizontally — frame its centre.
  const k = (tileAspect * crop.width) / cropAspect;
  const cx = crop.x + crop.width / 2;
  const posX = k < 1 ? ((cx - k / 2) / (1 - k)) * 100 : 50;
  const posY = crop.height < 0.999 ? (crop.y / (1 - crop.height)) * 100 : 0;
  return {
    ...bg,
    backgroundSize: `auto ${100 / crop.height}%`,
    backgroundPosition: `${pct(posX)} ${pct(posY)}`,
  };
}
