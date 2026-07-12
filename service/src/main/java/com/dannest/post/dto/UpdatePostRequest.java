package com.dannest.post.dto;

import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/**
 * Body of PATCH /api/v1/posts/{id} — a partial update.
 *
 * <p>A {@code null} field leaves the current value untouched. Providing {@code mediaIds}
 * replaces the post's images wholesale (an empty list removes them all); moving the post
 * to another {@code collectionId} requires the caller to own that collection too.
 */
public record UpdatePostRequest(
        UUID collectionId,
        @Size(max = 200) String title,
        String content,
        List<UUID> mediaIds) {
}
