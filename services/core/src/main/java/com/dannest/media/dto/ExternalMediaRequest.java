package com.dannest.media.dto;

import com.dannest.common.CropDto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Body of POST /api/v1/media/external — register an image link (with an optional crop). */
public record ExternalMediaRequest(
        @NotBlank
        @Size(max = 1024)
        @Pattern(regexp = "(?i)^https?://\\S+$", message = "URL must be a full http:// or https:// link")
        String url,
        CropDto crop) {
}
