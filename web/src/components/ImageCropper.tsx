"use client";

import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
// Required styles — react-easy-crop's classes have no inline styles, so without
// this the crop image/container are unstyled (invisible).
import "react-easy-crop/react-easy-crop.css";
import type { Crop } from "@/lib/media";

type Props = {
  /** Source to crop — a freshly picked file, or an existing image URL. */
  file?: File;
  imageUrl?: string;
  /** Restore a previous crop (fractions 0..1) when re-editing. */
  initialCrop?: Crop | null;
  /** Output aspect ratio (defaults to the cover ratio). */
  aspect?: number;
  /** "round" shows a circular selection mask — used for avatars. */
  cropShape?: "rect" | "round";
  /** Fill the parent (which must size it) instead of holding the `aspect` ratio box. */
  fill?: boolean;
  /** Reports the crop as fractions (0..1) of the image. */
  onCropChange: (crop: Crop) => void;
};

/**
 * Inline crop + zoom. It reports the crop as fractions of the image (not a baked
 * output) so the original is preserved and re-editable. Zoom via scroll/pinch.
 */
export default function ImageCropper({
  file,
  imageUrl,
  initialCrop,
  aspect = 16 / 10,
  cropShape = "rect",
  fill = false,
  onCropChange,
}: Props) {
  const [fileSrc, setFileSrc] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (imageUrl || !file) return;
    const reader = new FileReader();
    reader.onload = () => setFileSrc(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }, [file, imageUrl]);

  const src = imageUrl ?? fileSrc;

  // Frozen at mount: react-easy-crop re-applies `initialCroppedAreaPercentages`
  // whenever it changes, so feeding the live crop back here would fight the user's
  // adjustments (and effectively discard them). Remount (via `key`) to re-seed.
  const [initialPct] = useState<Area | undefined>(() =>
    initialCrop && !(initialCrop.width >= 0.999 && initialCrop.height >= 0.999)
      ? {
          x: initialCrop.x * 100,
          y: initialCrop.y * 100,
          width: initialCrop.width * 100,
          height: initialCrop.height * 100,
        }
      : undefined,
  );

  return (
    <div
      className={
        fill
          ? "relative h-full w-full overflow-hidden bg-slate-900"
          : "relative w-full overflow-hidden rounded-xl bg-slate-900"
      }
      style={fill ? undefined : { aspectRatio: aspect }}
    >
      {src && (
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          cropShape={cropShape}
          initialCroppedAreaPercentages={initialPct}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(area) =>
            onCropChange({
              x: area.x / 100,
              y: area.y / 100,
              width: area.width / 100,
              height: area.height / 100,
            })
          }
        />
      )}
    </div>
  );
}
