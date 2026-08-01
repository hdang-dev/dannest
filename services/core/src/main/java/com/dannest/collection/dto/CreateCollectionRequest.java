package com.dannest.collection.dto;

import com.dannest.collection.Visibility;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Body of POST /api/v1/collections.
 *
 * <p>{@code visibility} defaults to PUBLIC when omitted. The optional cover is a media
 * asset ({@code coverMediaId}) — uploaded or external — that the caller owns.
 */
public record CreateCollectionRequest(
        @NotBlank @Size(max = 120) String name,
        String description,
        Visibility visibility,
        UUID coverMediaId) {
}
