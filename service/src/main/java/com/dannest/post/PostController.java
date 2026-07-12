package com.dannest.post;

import com.dannest.common.PagedResponse;
import com.dannest.post.dto.CreatePostRequest;
import com.dannest.post.dto.PostResponse;
import com.dannest.post.dto.UpdatePostRequest;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class PostController {

    private final PostService postService;

    public PostController(PostService postService) {
        this.postService = postService;
    }

    /**
     * List posts by {@code scope} (FEED = public feed [default], MINE = the caller's own),
     * optionally narrowed by {@code q} (title search). Newest-first, paginated.
     */
    @GetMapping("/posts")
    public PagedResponse<PostResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "FEED") PostScope scope,
            @RequestParam(required = false) String q,
            Pageable pageable) {
        return postService.list(currentUserId(jwt), scope, null, q, pageable);
    }

    /** Posts in a single collection (if the caller may view it). */
    @GetMapping("/collections/{collectionId}/posts")
    public PagedResponse<PostResponse> listByCollection(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID collectionId,
            @RequestParam(required = false) String q,
            Pageable pageable) {
        return postService.list(currentUserId(jwt), null, collectionId, q, pageable);
    }

    /** A single post — visible if its collection is public or owned by the caller. */
    @GetMapping("/posts/{id}")
    public PostResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return postService.get(currentUserId(jwt), id);
    }

    @PostMapping("/posts")
    public ResponseEntity<PostResponse> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreatePostRequest request) {
        PostResponse created = postService.create(currentUserId(jwt), request);
        return ResponseEntity.created(URI.create("/api/v1/posts/" + created.id())).body(created);
    }

    @PatchMapping("/posts/{id}")
    public PostResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody UpdatePostRequest request) {
        return postService.update(currentUserId(jwt), id, request);
    }

    @DeleteMapping("/posts/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        postService.delete(currentUserId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    /** Like a post (idempotent). */
    @PostMapping("/posts/{id}/likes")
    public ResponseEntity<Void> like(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        postService.like(currentUserId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    /** Remove the caller's like (idempotent). */
    @DeleteMapping("/posts/{id}/likes")
    public ResponseEntity<Void> unlike(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        postService.unlike(currentUserId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    private static UUID currentUserId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
