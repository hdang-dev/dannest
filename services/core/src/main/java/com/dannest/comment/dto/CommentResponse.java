package com.dannest.comment.dto;

import com.dannest.media.dto.CropDto;
import java.time.Instant;
import java.util.UUID;

/**
 * API view of a comment: its text, author, and — if it's a reply — the parent comment it
 * replies to ({@code null} for a top-level comment). The frontend groups replies under
 * their parent for display.
 */
public record CommentResponse(
        UUID id,
        UUID postId,
        UUID authorId,
        String authorUsername,
        String authorAvatarUrl,
        CropDto authorAvatarCrop,
        UUID parentCommentId,
        String content,
        Instant createdAt,
        Instant updatedAt) {
}
