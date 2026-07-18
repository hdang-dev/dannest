package com.dannest.comment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Body of POST /api/v1/posts/{id}/comments.
 *
 * <p>{@code parentCommentId} is omitted (or {@code null}) for a top-level comment; set it
 * to reply to another comment on the same post.
 */
public record CreateCommentRequest(
        @NotBlank @Size(max = 2000) String content,
        UUID parentCommentId) {
}
