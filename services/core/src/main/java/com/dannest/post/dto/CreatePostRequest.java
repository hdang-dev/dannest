package com.dannest.post.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/**
 * Body of POST /api/v1/posts.
 *
 * <p>{@code images} are the post's images, in display order — each carries the media id
 * plus the url/crop services/media returned for it (Core no longer looks media up
 * itself). A post may have zero images.
 */
public record CreatePostRequest(
        @NotNull UUID collectionId,
        @NotBlank @Size(max = 200) String title,
        String content,
        List<PostImageInput> images) {
}
