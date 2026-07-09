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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/collections")
public class CollectionController {

    private final CollectionService collectionService;

    public CollectionController(CollectionService collectionService) {
        this.collectionService = collectionService;
    }

    /** List the authenticated user's own collections (paginated). */
    @GetMapping
    public PagedResponse<CollectionResponse> list(@AuthenticationPrincipal Jwt jwt, Pageable pageable) {
        return collectionService.listOwned(currentUserId(jwt), pageable);
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

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        collectionService.delete(currentUserId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    private static UUID currentUserId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
