package com.dannest.collection.dto;

import com.dannest.collection.Visibility;
import com.dannest.common.CropDto;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Body of PATCH /api/v1/collections/{id} — a partial update.
 *
 * <p>Every field is optional: a {@code null} field leaves the current value untouched.
 * Setting {@code coverMediaId} replaces the cover — send {@code coverUrl}/{@code coverCrop}
 * alongside it. {@code clearCover=true} removes it.
 */
public record UpdateCollectionRequest(
        @Size(max = 120) String name,
        String description,
        Visibility visibility,
        UUID coverMediaId,
        String coverUrl,
        CropDto coverCrop,
        Boolean clearCover) {
}
