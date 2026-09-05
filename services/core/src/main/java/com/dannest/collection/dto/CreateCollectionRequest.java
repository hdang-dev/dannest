package com.dannest.collection.dto;

import com.dannest.collection.Visibility;
import com.dannest.common.CropDto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Body of POST /api/v1/collections.
 *
 * <p>{@code visibility} defaults to PUBLIC when omitted. The optional cover is a media
 * asset ({@code coverMediaId}) the caller owns — {@code coverUrl}/{@code coverCrop} must
 * be sent alongside it (the values the {@code POST /api/v1/media} response returned for
 * that id); reads use that snapshot, not a live {@code media} lookup.
 *
 * <p>{@code priceCents} is required (and must be positive) when {@code visibility ==
 * MEMBERS_ONLY}, and must be omitted otherwise — see {@code CollectionService.create}.
 * Chosen once at creation; never editable afterward.
 */
public record CreateCollectionRequest(
        @NotBlank @Size(max = 120) String name,
        String description,
        Visibility visibility,
        @Positive Integer priceCents,
        String coverMediaId,
        String coverUrl,
        CropDto coverCrop) {
}
