package com.dannest.collection.dto;

import com.dannest.collection.Visibility;
import com.dannest.common.CropDto;
import jakarta.validation.constraints.Size;

/**
 * Body of PATCH /api/v1/collections/{id} — a partial update.
 *
 * <p>Every field is optional: a {@code null} field leaves the current value untouched.
 * Setting {@code coverMediaId} replaces the cover — send {@code coverUrl}/{@code coverCrop}
 * alongside it. {@code clearCover=true} removes it.
 *
 * <p>{@code visibility} can freely toggle PUBLIC &lt;-&gt; PRIVATE, but never transitions
 * into or out of MEMBERS_ONLY (that includes price — not a field here at all, since it
 * can't be set post-creation) — see {@code CollectionService.update}.
 */
public record UpdateCollectionRequest(
        @Size(max = 120) String name,
        String description,
        Visibility visibility,
        String coverMediaId,
        String coverUrl,
        CropDto coverCrop,
        Boolean clearCover) {
}
