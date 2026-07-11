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

  const initialPct: Area | undefined =
    initialCrop && !(initialCrop.width >= 0.999 && initialCrop.height >= 0.999)
      ? {
          x: initialCrop.x * 100,
          y: initialCrop.y * 100,
          width: initialCrop.width * 100,
          height: initialCrop.height * 100,
        }
      : undefined;

  return (
    <div className="relative aspect-16/10 w-full overflow-hidden rounded-xl bg-slate-900">
      {src && (
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
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
