package com.dannest.media.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of POST /api/v1/media/external — register an image link (with an optional crop). */
public record ExternalMediaRequest(@NotBlank @Size(max = 1024) String url, CropDto crop) {
}
