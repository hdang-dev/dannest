package com.dannest.post.dto;

import com.dannest.common.CropDto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * One image attached to a post at creation/update time — the media id plus the
 * url/crop the {@code POST /api/v1/media} response returned for it. Core stores this
 * snapshot verbatim on {@code post_media} (see docs/tech/db-schema.md's *Image crop*
 * notes) rather than joining to {@code media} on every read.
 */
public record PostImageInput(
        @NotNull String mediaId,
        @NotBlank String url,
        CropDto crop) {
}
