package com.dannest.post.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/**
 * Body of POST /api/v1/posts.
 *
 * <p>{@code mediaIds} are the post's images, in display order — each must be a media
 * asset the caller owns (uploaded or external). A post may have zero images.
 */
public record CreatePostRequest(
        @NotNull UUID collectionId,
        @NotBlank @Size(max = 200) String title,
        String content,
        List<UUID> mediaIds) {
}
