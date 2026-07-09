package com.dannest.collection.dto;

import com.dannest.collection.Visibility;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Body of PATCH /api/v1/collections/{id} — a partial update.
 *
 * <p>Every field is optional: a {@code null} field leaves the current value untouched.
 * (Because {@code null} means "unchanged", clearing the description or cover isn't
 * expressible here — send a new value to replace them.)
 */
public record UpdateCollectionRequest(
        @Size(max = 120) String name,
        String description,
        Visibility visibility,
        UUID coverMediaId) {
}
