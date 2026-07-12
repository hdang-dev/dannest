package com.dannest.post.dto;

import com.dannest.collection.Visibility;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * API view of a post: its text, author, owning collection, ordered images, and social
 * counts. A post inherits its visibility from its collection (per the spec, only
 * collections carry visibility), so {@code collectionVisibility} tells the UI whether to
 * show a private badge. Counts are batched by the service, so this has no {@code from(...)}.
 */
public record PostResponse(
        UUID id,
        UUID collectionId,
        String collectionName,
        Visibility collectionVisibility,
        UUID authorId,
        String authorUsername,
        String authorAvatarUrl,
        String title,
        String content,
        List<PostMediaResponse> images,
        long likeCount,
        boolean likedByMe,
        long commentCount,
        Instant createdAt,
        Instant updatedAt) {
}
