package com.dannest.follow;

import com.dannest.collection.Collection;
import com.dannest.collection.CollectionRepository;
import com.dannest.collection.Visibility;
import com.dannest.collection.dto.CollectionResponse;
import com.dannest.common.BadRequestException;
import com.dannest.common.PagedResponse;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.user.UserRepository;
import java.util.UUID;
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
    private final UserRepository userRepository;

    /** Follow a collection the caller may view and doesn't own; idempotent. */
    public void follow(UUID userId, UUID collectionId) {
        Collection collection = findFollowable(userId, collectionId);
        if (!followRepository.existsByFollower_IdAndCollection_Id(userId, collectionId)) {
            followRepository.save(CollectionFollow.builder()
                    .follower(userRepository.getReferenceById(userId))
                    .collection(collection)
                    .build());
        }
    }

    /** Unfollow a collection; idempotent. */
    public void unfollow(UUID userId, UUID collectionId) {
        followRepository.deleteByFollower_IdAndCollection_Id(userId, collectionId);
    }

    @Transactional(readOnly = true)
    public boolean isFollowing(UUID userId, UUID collectionId) {
        return followRepository.existsByFollower_IdAndCollection_Id(userId, collectionId);
    }

    /** The caller's followed collections, most recently followed first unless sorted otherwise. */
    @Transactional(readOnly = true)
    public PagedResponse<CollectionResponse> listFollowed(UUID userId, Pageable pageable) {
        Pageable effective = pageable.getSort().isSorted()
                ? pageable
                : PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                        Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<CollectionFollow> page = followRepository.findByFollowerId(userId, effective);
        return PagedResponse.of(page, f -> CollectionResponse.from(f.getCollection()));
    }

    /** Load a collection the caller may follow: visible to them, and not their own. */
    private Collection findFollowable(UUID userId, UUID collectionId) {
        Collection collection = collectionRepository
                .findById(collectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Collection not found: " + collectionId));
        boolean owned = collection.getOwner().getId().equals(userId);
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
