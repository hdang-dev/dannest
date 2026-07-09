package com.dannest.collection;

import com.dannest.collection.dto.CollectionResponse;
import com.dannest.collection.dto.CreateCollectionRequest;
import com.dannest.collection.dto.UpdateCollectionRequest;
import com.dannest.common.ForbiddenException;
import com.dannest.common.PagedResponse;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.media.Media;
import com.dannest.media.MediaRepository;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The full lifecycle of a collection: create, read (single + owner's list), partial
 * update, and delete. Every mutation is scoped to the authenticated caller — a user
 * can only change or remove collections they own.
 */
@Service
@Transactional
public class CollectionService {

    private final CollectionRepository collectionRepository;
    private final MediaRepository mediaRepository;
    private final UserRepository userRepository;

    public CollectionService(
            CollectionRepository collectionRepository,
            MediaRepository mediaRepository,
            UserRepository userRepository) {
        this.collectionRepository = collectionRepository;
        this.mediaRepository = mediaRepository;
        this.userRepository = userRepository;
    }

    public CollectionResponse create(UUID userId, CreateCollectionRequest request) {
        User owner = userRepository.getReferenceById(userId);
        Visibility visibility = request.visibility() != null ? request.visibility() : Visibility.PUBLIC;

        Collection collection = new Collection(owner, request.name(), visibility);
        collection.setDescription(request.description());
        if (request.coverMediaId() != null) {
            collection.setCover(resolveOwnedCover(userId, request.coverMediaId()));
        }
        return CollectionResponse.from(collectionRepository.save(collection));
    }

    @Transactional(readOnly = true)
    public PagedResponse<CollectionResponse> listOwned(UUID userId, Pageable pageable) {
        return PagedResponse.of(
                collectionRepository.findByOwnerId(userId, pageable), CollectionResponse::from);
    }

    @Transactional(readOnly = true)
    public CollectionResponse get(UUID userId, UUID collectionId) {
        Collection collection = findVisible(userId, collectionId);
        return CollectionResponse.from(collection);
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
        if (request.coverMediaId() != null) {
            collection.setCover(resolveOwnedCover(userId, request.coverMediaId()));
        }
        return CollectionResponse.from(collection);
    }

    public void delete(UUID userId, UUID collectionId) {
        Collection collection = findOwned(userId, collectionId);
        collectionRepository.delete(collection);
    }

    /** Load a collection the caller is allowed to view: it's PUBLIC, or the caller owns it. */
    private Collection findVisible(UUID userId, UUID collectionId) {
        Collection collection = findById(collectionId);
        boolean owned = collection.getOwner().getId().equals(userId);
        if (collection.getVisibility() == Visibility.PRIVATE && !owned) {
            // Hide the existence of private collections from non-owners.
            throw new ResourceNotFoundException("Collection not found: " + collectionId);
        }
        return collection;
    }

    /** Load a collection the caller must own to mutate; 404 if missing, 403 if not theirs. */
    private Collection findOwned(UUID userId, UUID collectionId) {
        Collection collection = findById(collectionId);
        if (!collection.getOwner().getId().equals(userId)) {
            throw new ForbiddenException("You do not own this collection");
        }
        return collection;
    }

    private Collection findById(UUID collectionId) {
        return collectionRepository
                .findById(collectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Collection not found: " + collectionId));
    }

    /** Resolve a cover media id, enforcing that the caller owns the referenced asset. */
    private Media resolveOwnedCover(UUID userId, UUID mediaId) {
        Media media = mediaRepository
                .findById(mediaId)
                .orElseThrow(() -> new ResourceNotFoundException("Media not found: " + mediaId));
        if (!media.getOwner().getId().equals(userId)) {
            throw new ForbiddenException("You do not own this media");
        }
        return media;
    }
}
