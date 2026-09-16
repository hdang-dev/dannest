// Downscale an image to a WebP blob, keeping the WHOLE image (no crop). The crop is
// stored separately and applied at display time, so the original framing is preserved
// and re-editable. Downscaling keeps stored covers small.
export async function fileToWebp(file: Blob, maxDim = 2000, quality = 0.9): Promise<Blob> {
  const img = await loadImage(await blobToDataUrl(file));
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, w, h);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image"))),
      "image/webp",
      quality,
    ),
  );
}

const DRIVE_VIEW_URL = /^https:\/\/drive\.google\.com\/file\/d\/([^/]+)\/view/i;

/**
 * Google Drive's "Share" link (…/file/d/ID/view) opens Drive's HTML viewer, not the
 * image bytes, so it fails to load as an <img src>. Drive's own "direct" endpoints
 * (uc?export=view, drive.usercontent.google.com/download) send
 * Cross-Origin-Resource-Policy: same-site, which browsers use to block exactly this
 * cross-site <img> embedding — so those don't work either, despite loading fine via
 * curl or a top-level navigation. lh3.googleusercontent.com (Google's photo CDN,
 * also serving Drive thumbnails) sends Access-Control-Allow-Origin: * and no CORP
 * header, so it's the only Drive-derived URL that's actually embeddable cross-site.
 * Already-direct links (or any non-Drive URL) pass through unchanged.
 */
export function normalizeImageUrl(url: string): { url: string; reformatted: boolean } {
  const match = url.match(DRIVE_VIEW_URL);
  if (!match) return { url, reformatted: false };
  return { url: `https://lh3.googleusercontent.com/d/${match[1]}`, reformatted: true };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}
