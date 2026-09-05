package com.dannest.follow;

import com.dannest.collection.Collection;
import com.dannest.collection.CollectionRepository;
import com.dannest.collection.CollectionService;
import com.dannest.collection.Visibility;
import com.dannest.collection.dto.CollectionResponse;
import com.dannest.common.BadRequestException;
import com.dannest.common.PagedResponse;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.notification.ActivityType;
import com.dannest.notification.NotificationService;
import com.dannest.notification.NotificationType;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Following a collection, to be notified of its new posts: follow / unfollow (both
 * idempotent), and the caller's list of followed collections ("My Subscriptions").
 */
@Service
@Transactional
@RequiredArgsConstructor
public class FollowService {

    private final CollectionFollowRepository followRepository;
    private final CollectionRepository collectionRepository;
    private final CollectionService collectionService;
    private final NotificationService notificationService;

    /** Follow a collection the caller may view and doesn't own; idempotent. */
    public void follow(UUID userId, UUID collectionId) {
        Collection collection = findFollowable(userId, collectionId);
        if (!followRepository.existsByFollowerIdAndCollectionId(userId, collectionId)) {
            followRepository.save(CollectionFollow.builder()
                    .followerId(userId)
                    .collectionId(collection.getId())
                    .build());
            notificationService.notify(
                    collection.getOwnerId(), userId, NotificationType.FOLLOW, collectionId, null, null);
            notificationService.publishActivity(
                    userId, ActivityType.COLLECTION_FOLLOWED, collectionId, null, null);
        }
    }

    /** Unfollow a collection; idempotent. */
    public void unfollow(UUID userId, UUID collectionId) {
        followRepository.deleteByFollowerIdAndCollectionId(userId, collectionId);
    }

    @Transactional(readOnly = true)
    public boolean isFollowing(UUID userId, UUID collectionId) {
        return followRepository.existsByFollowerIdAndCollectionId(userId, collectionId);
    }

    /** The caller's followed collections, most recently followed first unless sorted otherwise. */
    @Transactional(readOnly = true)
    public PagedResponse<CollectionResponse> listFollowed(UUID userId, Pageable pageable) {
        Pageable effective = pageable.getSort().isSorted()
                ? pageable
                : PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                        Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<CollectionFollow> page = followRepository.findByFollowerId(userId, effective);

        List<UUID> collectionIds = page.getContent().stream().map(CollectionFollow::getCollectionId).toList();
        Map<UUID, Collection> collectionsById = collectionRepository.findAllById(collectionIds).stream()
                .collect(Collectors.toMap(Collection::getId, c -> c));
        // Preserve the page's follow order (findAllById does not guarantee it).
        List<Collection> ordered = collectionIds.stream()
                .map(collectionsById::get)
                .filter(Objects::nonNull)
                .toList();

        return new PagedResponse<>(
                collectionService.toResponses(ordered, userId), page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages(), page.isLast());
    }

    /** Load a collection the caller may follow: visible to them, and not their own. */
    private Collection findFollowable(UUID userId, UUID collectionId) {
        Collection collection = collectionRepository
                .findById(collectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Collection not found: " + collectionId));
        boolean owned = collection.getOwnerId().equals(userId);
        if (collection.getVisibility() == Visibility.PRIVATE && !owned) {
            // Hide the existence of private collections from non-owners.
            throw new ResourceNotFoundException("Collection not found: " + collectionId);
        }
        if (owned) {
            throw new BadRequestException("You cannot follow your own collection");
        }
        return collection;
    }
}
