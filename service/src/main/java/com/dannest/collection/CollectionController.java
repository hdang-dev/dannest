package com.dannest.collection;

import com.dannest.collection.dto.CollectionResponse;
import com.dannest.collection.dto.CreateCollectionRequest;
import com.dannest.collection.dto.UpdateCollectionRequest;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/collections")
public class CollectionController {

    private final CollectionService collectionService;

    public CollectionController(CollectionService collectionService) {
        this.collectionService = collectionService;
    }

    /**
     * List collections, filtered by:
     * {@code scope} (MINE = your own [default], PUBLIC = every user's public / home feed),
     * {@code visibility} (PUBLIC/PRIVATE — scope=MINE only), {@code archived} (true = archived
     * only, else active — scope=MINE only), and {@code q} (name search).
     */
    @GetMapping
    public PagedResponse<CollectionResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "MINE") CollectionScope scope,
            @RequestParam(required = false) Visibility visibility,
            @RequestParam(required = false) Boolean archived,
            @RequestParam(required = false) String q,
            Pageable pageable) {
        return collectionService.list(currentUserId(jwt), scope, visibility, archived, q, pageable);
    }

    /** A single collection — visible if PUBLIC or owned by the caller. */
    @GetMapping("/{id}")
    public CollectionResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return collectionService.get(currentUserId(jwt), id);
    }

    @PostMapping
    public ResponseEntity<CollectionResponse> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateCollectionRequest request) {
        CollectionResponse created = collectionService.create(currentUserId(jwt), request);
        return ResponseEntity.created(URI.create("/api/v1/collections/" + created.id())).body(created);
    }

    @PatchMapping("/{id}")
    public CollectionResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateCollectionRequest request) {
        return collectionService.update(currentUserId(jwt), id, request);
    }

    /** Archive (soft-delete) a collection — hidden from listings but recoverable. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> archive(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        collectionService.archive(currentUserId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    /** Restore a previously archived collection. */
    @PostMapping("/{id}/unarchive")
    public CollectionResponse unarchive(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        collectionService.unarchive(currentUserId(jwt), id);
        return collectionService.get(currentUserId(jwt), id);
    }

    private static UUID currentUserId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
