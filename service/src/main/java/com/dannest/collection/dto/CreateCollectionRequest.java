package com.dannest.collection.dto;

import com.dannest.collection.Visibility;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Body of POST /api/v1/collections.
 *
 * <p>{@code visibility} defaults to PUBLIC when omitted; {@code coverMediaId} is optional
 * and, when present, must reference a media asset owned by the caller.
 */
public record CreateCollectionRequest(
        @NotBlank @Size(max = 120) String name,
        String description,
        Visibility visibility,
        UUID coverMediaId) {
}
