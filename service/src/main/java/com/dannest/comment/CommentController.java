package com.dannest.comment;

import com.dannest.comment.dto.CommentResponse;
import com.dannest.comment.dto.CreateCommentRequest;
import com.dannest.comment.dto.UpdateCommentRequest;
import com.dannest.common.PagedResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    /** A post's comments (top-level and replies, flat), oldest-first unless the request specifies a sort. */
    @GetMapping("/posts/{postId}/comments")
    public PagedResponse<CommentResponse> list(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID postId, Pageable pageable) {
        return commentService.list(currentUserId(jwt), postId, pageable);
    }

    @PostMapping("/posts/{postId}/comments")
    public ResponseEntity<CommentResponse> create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID postId,
            @Valid @RequestBody CreateCommentRequest request) {
        CommentResponse created = commentService.create(currentUserId(jwt), postId, request);
        return ResponseEntity.created(URI.create("/api/v1/comments/" + created.id())).body(created);
    }

    @PatchMapping("/comments/{id}")
    public CommentResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateCommentRequest request) {
        return commentService.update(currentUserId(jwt), id, request);
    }

    @DeleteMapping("/comments/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        commentService.delete(currentUserId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    private static UUID currentUserId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
