package com.dannest.collection;

import com.dannest.collection.dto.CollectionResponse;
import com.dannest.collection.dto.CreateCollectionRequest;
import com.dannest.collection.dto.UpdateCollectionRequest;
import com.dannest.common.BadRequestException;
import com.dannest.common.ForbiddenException;
import com.dannest.common.PagedResponse;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.membership.CollectionMembership;
import com.dannest.membership.CollectionMembershipRepository;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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
    private final CollectionMembershipRepository membershipRepository;

    public CollectionResponse create(UUID userId, CreateCollectionRequest request) {
        Visibility visibility = request.visibility() != null ? request.visibility() : Visibility.PUBLIC;
        validatePrice(visibility, request.priceCents());

        Collection collection = Collection.builder()
                .ownerId(userId)
                .name(request.name())
                .visibility(visibility)
                .priceCents(visibility == Visibility.MEMBERS_ONLY ? request.priceCents() : null)
                .build();
        collection.setDescription(request.description());
        // Pre-existing bug, fixed here: this called applyCover unconditionally, which
        // throws when no cover is given at all — but a cover has always been optional
        // (see CreateCollectionRequest's javadoc). Guard it the same way update() already
        // does.
        if (request.coverMediaId() != null) {
            applyCover(collection, request.coverMediaId(), request.coverUrl(), request.coverCrop());
        }
        return toResponse(collectionRepository.save(collection), userId);
    }

    /**
     * List collections with filters:
     * <ul>
     *   <li>{@code scope=MINE} — the caller's own; {@code visibility} narrows to PUBLIC/PRIVATE/MEMBERS_ONLY (null = all)</li>
     *   <li>{@code scope=PUBLIC} — every user's PUBLIC and MEMBERS_ONLY collections (the home feed —
     *       MEMBERS_ONLY is browsable so buyers can find it; its *posts* are gated separately,
     *       see {@code PostService}); {@code visibility} is ignored</li>
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
            // The public feed is always active, and browsable (PUBLIC or MEMBERS_ONLY —
            // never PRIVATE). A MEMBERS_ONLY collection's *posts* stay gated regardless;
            // this only controls whether the collection itself (name/cover/price) is listed.
            filters.add((root, cq, cb) -> cb.isNull(root.get("archivedAt")));
            filters.add((root, cq, cb) -> root.get("visibility").in(Visibility.PUBLIC, Visibility.MEMBERS_ONLY));
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
                toResponses(page.getContent(), userId), page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages(), page.isLast());
    }

    @Transactional(readOnly = true)
    public CollectionResponse get(UUID userId, UUID collectionId) {
        Collection collection = findVisible(userId, collectionId);
        return toResponse(collection, userId);
    }

    public CollectionResponse update(UUID userId, UUID collectionId, UpdateCollectionRequest request) {
        Collection collection = findOwned(userId, collectionId);

        if (request.visibility() != null) {
            // MEMBERS_ONLY is a one-way door — chosen at creation, never entered or left
            // afterward. A membership purchase would otherwise become worthless (-> PUBLIC)
            // or lock a paying buyer out (-> PRIVATE); price is likewise frozen with it
            // (there's no priceCents field on UpdateCollectionRequest at all).
            boolean touchesMembersOnly = collection.getVisibility() == Visibility.MEMBERS_ONLY
                    || request.visibility() == Visibility.MEMBERS_ONLY;
            if (touchesMembersOnly && request.visibility() != collection.getVisibility()) {
                throw new BadRequestException("A members-only collection's type can't be changed.");
            }
            collection.setVisibility(request.visibility());
        }
        if (request.name() != null) {
            collection.setName(request.name());
        }
        if (request.description() != null) {
            collection.setDescription(request.description());
        }
        // clearCover removes the cover; otherwise a new coverMediaId replaces it.
        if (Boolean.TRUE.equals(request.clearCover())) {
            collection.setCoverMediaId(null);
            collection.setCoverUrl(null);
        } else if (request.coverMediaId() != null) {
            applyCover(collection, request.coverMediaId(), request.coverUrl(), request.coverCrop());
        }
        return toResponse(collection, userId);
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

    CollectionResponse toResponse(Collection collection, UUID viewerId) {
        return toResponses(List.of(collection), viewerId).get(0);
    }

    /**
     * Map a page of collections to responses, batching the owner lookup and the viewer's
     * membership lookup into one grouped query each rather than one per collection.
     * Public — {@link com.dannest.follow.FollowService} reuses it for followed collections.
     */
    public List<CollectionResponse> toResponses(List<Collection> collections, UUID viewerId) {
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

        List<UUID> membersOnlyIds = collections.stream()
                .filter(c -> c.getVisibility() == Visibility.MEMBERS_ONLY)
                .map(Collection::getId)
                .toList();
        Set<UUID> memberOf = membersOnlyIds.isEmpty()
                ? Set.of()
                : membershipRepository.findByUserIdAndCollectionIdInAndRevokedAtIsNull(viewerId, membersOnlyIds)
                        .stream()
                        .map(CollectionMembership::getCollectionId)
                        .collect(Collectors.toSet());

        return collections.stream()
                .map(c -> CollectionResponse.from(c, ownersById.get(c.getOwnerId()), memberOf.contains(c.getId())))
                .toList();
    }

    // ----- helpers -------------------------------------------------------------------

    private static void validatePrice(Visibility visibility, Integer priceCents) {
        if (visibility == Visibility.MEMBERS_ONLY) {
            if (priceCents == null || priceCents <= 0) {
                throw new BadRequestException("priceCents is required (> 0) for a MEMBERS_ONLY collection");
            }
        } else if (priceCents != null) {
            throw new BadRequestException("priceCents is only valid for a MEMBERS_ONLY collection");
        }
    }

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

    /** Stores the cover reference plus the url/crop snapshot the caller sent — copied
     * verbatim, no lookup against {@code media}. */
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
