package com.dannest.post.dto;

import com.dannest.common.CropDto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * One image attached to a post at creation/update time — the media id plus the
 * url/crop services/media returned for it. Core stores this snapshot verbatim
 * (see docs/tech/architecture-flows.md's media-split notes) rather than looking
 * the media up itself, since it no longer shares a database with services/media.
 */
public record PostImageInput(
        @NotNull java.util.UUID mediaId,
        @NotBlank String url,
        CropDto crop) {
}
