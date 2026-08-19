package com.dannest.collection;

import com.dannest.collection.dto.CollectionResponse;
import com.dannest.collection.dto.CreateCollectionRequest;
import com.dannest.collection.dto.UpdateCollectionRequest;
import com.dannest.common.BadRequestException;
import com.dannest.common.ForbiddenException;
import com.dannest.common.PagedResponse;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The full lifecycle of a collection: create, read (single + owner's list), partial
 * update, and delete. Every mutation is scoped to the authenticated caller — a user
 * can only change or remove collections they own.
 */
@Service
@Transactional
@RequiredArgsConstructor
public class CollectionService {

    private final CollectionRepository collectionRepository;
    private final UserRepository userRepository;

    public CollectionResponse create(UUID userId, CreateCollectionRequest request) {
        Visibility visibility = request.visibility() != null ? request.visibility() : Visibility.PUBLIC;

        Collection collection = Collection.builder()
                .ownerId(userId)
                .name(request.name())
                .visibility(visibility)
                .build();
        collection.setDescription(request.description());
        applyCover(collection, request.coverMediaId(), request.coverUrl(), request.coverCrop());
        return toResponse(collectionRepository.save(collection));
    }

    /**
     * List collections with filters:
     * <ul>
     *   <li>{@code scope=MINE} — the caller's own; {@code visibility} narrows to PUBLIC/PRIVATE (null = all)</li>
     *   <li>{@code scope=PUBLIC} — every user's public collections (the home feed); {@code visibility} is ignored</li>
     * </ul>
     * Results exclude archived collections and default to newest-first when unsorted.
     */
    @Transactional(readOnly = true)
    public PagedResponse<CollectionResponse> list(
            UUID userId,
            CollectionScope scope,
            Visibility visibility,
            Boolean archived,
            String query,
            Pageable pageable) {
        String q = (query == null || query.isBlank()) ? null : query.trim();
        Pageable effective = pageable.getSort().isSorted()
                ? pageable
                : PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                        Sort.by(Sort.Direction.DESC, "createdAt"));

        // Build predicates for only the filters that are present — so a null filter
        // never becomes a nullable SQL parameter (which Postgres can't type-infer).
        List<Specification<Collection>> filters = new ArrayList<>();
        if (scope == CollectionScope.PUBLIC) {
            // The public feed is always active + public.
            filters.add((root, cq, cb) -> cb.isNull(root.get("archivedAt")));
            filters.add((root, cq, cb) -> cb.equal(root.get("visibility"), Visibility.PUBLIC));
        } else {
            filters.add((root, cq, cb) -> cb.equal(root.get("ownerId"), userId));
            // archived == true → archived only; otherwise active only.
            if (Boolean.TRUE.equals(archived)) {
                filters.add((root, cq, cb) -> cb.isNotNull(root.get("archivedAt")));
            } else {
                filters.add((root, cq, cb) -> cb.isNull(root.get("archivedAt")));
            }
            if (visibility != null) {
                filters.add((root, cq, cb) -> cb.equal(root.get("visibility"), visibility));
            }
        }
        if (q != null) {
            String like = "%" + q.toLowerCase() + "%";
            filters.add((root, cq, cb) -> cb.like(cb.lower(root.get("name")), like));
        }

        Specification<Collection> spec = Specification.allOf(filters);
        var page = collectionRepository.findAll(spec, effective);
        return new PagedResponse<>(
                toResponses(page.getContent()), page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages(), page.isLast());
    }

    @Transactional(readOnly = true)
    public CollectionResponse get(UUID userId, UUID collectionId) {
        Collection collection = findVisible(userId, collectionId);
        return toResponse(collection);
    }

    public CollectionResponse update(UUID userId, UUID collectionId, UpdateCollectionRequest request) {
        Collection collection = findOwned(userId, collectionId);

        if (request.name() != null) {
            collection.setName(request.name());
        }
        if (request.description() != null) {
            collection.setDescription(request.description());
        }
        if (request.visibility() != null) {
            collection.setVisibility(request.visibility());
        }
        // clearCover removes the cover; otherwise a new coverMediaId replaces it.
        if (Boolean.TRUE.equals(request.clearCover())) {
            collection.setCoverMediaId(null);
            collection.setCoverUrl(null);
        } else if (request.coverMediaId() != null) {
            applyCover(collection, request.coverMediaId(), request.coverUrl(), request.coverCrop());
        }
        return toResponse(collection);
    }

    /** Soft-delete: archive the collection so it's hidden from listings but recoverable. */
    public void archive(UUID userId, UUID collectionId) {
        Collection collection = findOwned(userId, collectionId);
        collection.archive();
    }

    /** Restore a previously archived collection. */
    public void unarchive(UUID userId, UUID collectionId) {
        Collection collection = findOwned(userId, collectionId);
        collection.unarchive();
    }

    // ----- mapping -------------------------------------------------------------------

    CollectionResponse toResponse(Collection collection) {
        return toResponses(List.of(collection)).get(0);
    }

    /**
     * Map a page of collections to responses, batching the owner lookup into a single
     * grouped query rather than one per collection.
     * Public — {@link com.dannest.follow.FollowService} reuses it for followed collections.
     */
    public List<CollectionResponse> toResponses(List<Collection> collections) {
        if (collections.isEmpty()) {
            return List.of();
        }
        Set<UUID> ownerIds = new HashSet<>();
        for (Collection c : collections) {
            ownerIds.add(c.getOwnerId());
        }
        Map<UUID, User> ownersById = new LinkedHashMap<>();
        for (User u : userRepository.findAllById(ownerIds)) {
            ownersById.put(u.getId(), u);
        }

        return collections.stream()
                .map(c -> CollectionResponse.from(c, ownersById.get(c.getOwnerId())))
                .toList();
    }

    // ----- helpers -------------------------------------------------------------------

    /** Load a collection the caller is allowed to view: it's PUBLIC, or the caller owns it. */
    private Collection findVisible(UUID userId, UUID collectionId) {
        Collection collection = findById(collectionId);
        boolean owned = collection.getOwnerId().equals(userId);
        if (collection.getVisibility() == Visibility.PRIVATE && !owned) {
            // Hide the existence of private collections from non-owners.
            throw new ResourceNotFoundException("Collection not found: " + collectionId);
        }
        return collection;
    }

    /** Load a collection the caller must own to mutate; 404 if missing, 403 if not theirs. */
    private Collection findOwned(UUID userId, UUID collectionId) {
        Collection collection = findById(collectionId);
        if (!collection.getOwnerId().equals(userId)) {
            throw new ForbiddenException("You do not own this collection");
        }
        return collection;
    }

    private Collection findById(UUID collectionId) {
        return collectionRepository
                .findById(collectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Collection not found: " + collectionId));
    }

    /** Stores the cover reference plus the url/crop snapshot the caller sent (services/media
     * already enforced ownership when it issued that media id — see media-split notes). */
    private void applyCover(Collection collection, String mediaId, String url, com.dannest.common.CropDto crop) {
        if (url == null || url.isBlank()) {
            throw new BadRequestException("coverUrl is required when setting coverMediaId");
        }
        collection.setCoverMediaId(mediaId);
        collection.setCoverUrl(url);
        if (crop != null) {
            collection.setCoverCrop(crop.toEntity());
        }
    }
}
