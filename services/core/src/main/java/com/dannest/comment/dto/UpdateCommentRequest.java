package com.dannest.comment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of PATCH /api/v1/comments/{id} — replaces the comment's text. */
public record UpdateCommentRequest(@NotBlank @Size(max = 2000) String content) {
}
