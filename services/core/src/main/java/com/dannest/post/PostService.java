package com.dannest.post;

import com.dannest.collection.Collection;
import com.dannest.collection.CollectionRepository;
import com.dannest.collection.Visibility;
import com.dannest.comment.CommentRepository;
import com.dannest.common.AggregateCount;
import com.dannest.common.BadRequestException;
import com.dannest.common.ForbiddenException;
import com.dannest.common.PagedResponse;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.follow.CollectionFollowRepository;
import com.dannest.notification.NotificationService;
import com.dannest.notification.NotificationType;
import com.dannest.post.dto.CreatePostRequest;
import com.dannest.post.dto.PostImageInput;
import com.dannest.post.dto.PostMediaResponse;
import com.dannest.post.dto.PostResponse;
import com.dannest.post.dto.UpdatePostRequest;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The full lifecycle of a post: create (with ordered images), read (single +
 * feed /
 * mine / by-collection lists), partial update, delete, and like / unlike.
 * Mutations are
 * scoped to the caller — only a post's author may edit or delete it, and posts
 * can only
 * be created in (or moved to) a collection the caller owns. Visibility is
 * inherited from
 * the owning collection.
 */
@Service
@Transactional
@RequiredArgsConstructor
public class PostService {

    private final PostRepository postRepository;
    private final PostMediaRepository postMediaRepository;
    private final PostLikeRepository postLikeRepository;
    private final CommentRepository commentRepository;
    private final CollectionRepository collectionRepository;
    private final UserRepository userRepository;
    private final CollectionFollowRepository collectionFollowRepository;
    private final NotificationService notificationService;

    public PostResponse create(UUID userId, CreatePostRequest request) {
        Collection collection = resolveOwnedCollection(userId, request.collectionId());

        Post post = postRepository.save(Post.builder()
                .collectionId(collection.getId())
                .authorId(userId)
                .title(request.title().trim())
                .content(trimToNull(request.content()))
                .build());
        attachMedia(post, request.images());
        notifyFollowers(userId, collection, post);
        return toResponse(post, userId);
    }

    /** Tell everyone following this collection that it has a new post. */
    private void notifyFollowers(UUID authorId, Collection collection, Post post) {
        for (UUID followerId : collectionFollowRepository.findFollowerIdByCollectionId(collection.getId())) {
            notificationService.notify(
                    followerId, authorId, NotificationType.NEW_POST, collection.getId(), post.getId(), null);
        }
    }

    /**
     * List posts with filters:
     * <ul>
     * <li>{@code collectionId} set — posts in that collection (if the caller may
     * view it); scope is ignored</li>
     * <li>{@code scope=FEED} — posts in every user's public, non-archived
     * collections</li>
     * <li>{@code scope=MINE} — posts the caller authored</li>
     * </ul>
     * {@code q} narrows by title. Newest-first unless the request specifies a sort.
     */
    @Transactional(readOnly = true)
    public PagedResponse<PostResponse> list(
            UUID userId, PostScope scope, UUID collectionId, String query, Pageable pageable) {
        String q = (query == null || query.isBlank()) ? null : query.trim();
        Pageable effective = pageable.getSort().isSorted()
                ? pageable
                : PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                        Sort.by(Sort.Direction.DESC, "createdAt"));

        List<Specification<Post>> filters = new ArrayList<>();
        if (collectionId != null) {
            // Access is decided by the collection's visibility, then we simply scope to it.
            requireVisibleCollection(userId, collectionId);
            filters.add((root, cq, cb) -> cb.equal(root.get("collectionId"), collectionId));
        } else if (scope == PostScope.MINE) {
            filters.add((root, cq, cb) -> cb.equal(root.get("authorId"), userId));
        } else {
            // FEED: public, non-archived collections only — via a subquery, since Post
            // no longer holds a mapped association to Collection to join through.
            filters.add((root, cq, cb) -> {
                Subquery<UUID> sub = cq.subquery(UUID.class);
                Root<Collection> c = sub.from(Collection.class);
                sub.select(c.get("id"))
                        .where(cb.equal(c.get("visibility"), Visibility.PUBLIC), cb.isNull(c.get("archivedAt")));
                return root.get("collectionId").in(sub);
            });
        }
        if (q != null) {
            String like = "%" + q.toLowerCase() + "%";
            filters.add((root, cq, cb) -> cb.like(cb.lower(root.get("title")), like));
        }
        filters.add((root, cq, cb) -> cb.isNull(root.get("deletedAt")));

        Page<Post> page = postRepository.findAll(Specification.allOf(filters), effective);
        List<PostResponse> content = toResponses(page.getContent(), userId);
        return new PagedResponse<>(
                content, page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages(), page.isLast());
    }

    @Transactional(readOnly = true)
    public PostResponse get(UUID userId, UUID postId) {
        return toResponse(findVisible(userId, postId), userId);
    }

    public PostResponse update(UUID userId, UUID postId, UpdatePostRequest request) {
        Post post = findOwned(userId, postId);

        if (request.collectionId() != null) {
            post.setCollectionId(resolveOwnedCollection(userId, request.collectionId()).getId());
        }
        if (request.title() != null) {
            String title = request.title().trim();
            if (title.isEmpty()) {
                throw new BadRequestException("Title cannot be blank");
            }
            post.setTitle(title);
        }
        if (request.content() != null) {
            post.setContent(trimToNull(request.content()));
        }
        // Providing images replaces the post's images wholesale.
        if (request.images() != null) {
            postMediaRepository.deleteByPostId(post.getId());
            postMediaRepository.flush();
            attachMedia(post, request.images());
        }
        return toResponse(post, userId);
    }

    /**
     * Soft-delete a post — hidden from feeds/lookups but recoverable; images,
     * likes, and comments stay put.
     */
    public void delete(UUID userId, UUID postId) {
        Post post = findOwned(userId, postId);
        post.softDelete();
    }

    /** Like a post the caller can view (idempotent — a second like is a no-op). */
    public void like(UUID userId, UUID postId) {
        Post post = findVisible(userId, postId);
        if (!postLikeRepository.existsByPostIdAndUserId(postId, userId)) {
            postLikeRepository.save(PostLike.builder()
                    .postId(post.getId())
                    .userId(userId)
                    .build());
        }
    }

    /** Remove the caller's like (idempotent). */
    public void unlike(UUID userId, UUID postId) {
        findVisible(userId, postId);
        postLikeRepository.deleteByPostIdAndUserId(postId, userId);
    }

    // ----- mapping
    // -------------------------------------------------------------------

    private PostResponse toResponse(Post post, UUID userId) {
        return toResponses(List.of(post), userId).get(0);
    }

    /**
     * Map a page of posts to responses, batching the images and social counts, and the
     * collection/author lookups into a handful of grouped queries rather than several
     * per post. Author avatars are the author's own denormalized snapshot — no media
     * lookup needed.
     */
    private List<PostResponse> toResponses(List<Post> posts, UUID userId) {
        if (posts.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = posts.stream().map(Post::getId).toList();

        List<PostMedia> postMediaRows = postMediaRepository.findByPostIdInOrderByDisplayOrder(ids);
        Map<UUID, List<PostMediaResponse>> imagesByPost = new LinkedHashMap<>();
        for (PostMedia pm : postMediaRows) {
            imagesByPost
                    .computeIfAbsent(pm.getPostId(), k -> new ArrayList<>())
                    .add(PostMediaResponse.from(pm));
        }

        Map<UUID, Long> likeCounts = toCountMap(postLikeRepository.countByPostIds(ids));
        Map<UUID, Long> commentCounts = toCountMap(commentRepository.countByPostIds(ids));
        Set<UUID> likedByMe = new HashSet<>(postLikeRepository.findLikedPostIds(userId, ids));

        Set<UUID> collectionIds = posts.stream().map(Post::getCollectionId).collect(Collectors.toSet());
        Map<UUID, Collection> collectionsById = toMap(collectionRepository.findAllById(collectionIds),
                Collection::getId);
        Set<UUID> authorIds = posts.stream().map(Post::getAuthorId).collect(Collectors.toSet());
        Map<UUID, User> authorsById = toMap(userRepository.findAllById(authorIds), User::getId);

        return posts.stream()
                .map(p -> {
                    Collection c = collectionsById.get(p.getCollectionId());
                    User a = authorsById.get(p.getAuthorId());
                    return new PostResponse(
                            p.getId(),
                            c.getId(),
                            c.getName(),
                            c.getVisibility(),
                            a.getId(),
                            a.getUsername(),
                            a.getAvatarMediaUrl(),
                            a.getAvatarMediaUrl() != null ? com.dannest.common.CropDto.from(a.getAvatarCrop()) : null,
                            p.getTitle(),
                            p.getContent(),
                            imagesByPost.getOrDefault(p.getId(), List.of()),
                            likeCounts.getOrDefault(p.getId(), 0L),
                            likedByMe.contains(p.getId()),
                            commentCounts.getOrDefault(p.getId(), 0L),
                            p.getCreatedAt(),
                            p.getUpdatedAt());
                })
                .toList();
    }

    private static Map<UUID, Long> toCountMap(List<AggregateCount> counts) {
        return counts.stream().collect(Collectors.toMap(AggregateCount::getId, AggregateCount::getCount));
    }

    private static <T> Map<UUID, T> toMap(Iterable<T> entities, java.util.function.Function<T, UUID> idFn) {
        Map<UUID, T> map = new LinkedHashMap<>();
        for (T entity : entities) {
            map.put(idFn.apply(entity), entity);
        }
        return map;
    }

    // ----- helpers
    // -------------------------------------------------------------------

    /**
     * Store the post's images from the caller-supplied url/crop snapshots (services/media
     * already enforced ownership when it issued those media ids — see media-split notes).
     */
    private void attachMedia(Post post, List<PostImageInput> images) {
        if (images == null) {
            return;
        }
        int order = 0;
        Set<UUID> seen = new HashSet<>();
        for (PostImageInput image : images) {
            if (image == null || image.mediaId() == null || !seen.add(image.mediaId())) {
                continue; // ignore nulls and duplicates (the (post, media) pair is unique)
            }
            PostMedia.PostMediaBuilder builder = PostMedia.builder()
                    .postId(post.getId())
                    .mediaId(image.mediaId())
                    .url(image.url())
                    .displayOrder(order++);
            if (image.crop() != null) {
                builder.crop(image.crop().toEntity());
            }
            postMediaRepository.save(builder.build());
        }
    }

    /**
     * Load a post the caller may view: its collection is PUBLIC, or the caller owns
     * it / authored the post.
     */
    private Post findVisible(UUID userId, UUID postId) {
        Post post = findById(postId);
        Collection c = collectionRepository
                .findById(post.getCollectionId())
                .orElseThrow(() -> new ResourceNotFoundException("Collection not found: " + post.getCollectionId()));
        boolean owned = c.getOwnerId().equals(userId) || post.getAuthorId().equals(userId);
        if (c.getVisibility() == Visibility.PRIVATE && !owned) {
            // Hide the existence of posts in private collections from non-owners.
            throw new ResourceNotFoundException("Post not found: " + postId);
        }
        return post;
    }

    /**
     * Load a post the caller must have authored to mutate; 404 if missing, 403 if
     * not theirs.
     */
    private Post findOwned(UUID userId, UUID postId) {
        Post post = findById(postId);
        if (!post.getAuthorId().equals(userId)) {
            throw new ForbiddenException("You do not own this post");
        }
        return post;
    }

    private Post findById(UUID postId) {
        return postRepository
                .findByIdAndDeletedAtIsNull(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found: " + postId));
    }

    private Collection resolveOwnedCollection(UUID userId, UUID collectionId) {
        Collection collection = collectionRepository
                .findById(collectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Collection not found: " + collectionId));
        if (!collection.getOwnerId().equals(userId)) {
            throw new ForbiddenException("You can only post to a collection you own");
        }
        return collection;
    }

    /**
     * Ensure the caller may view a collection (for its post list); 404 if private
     * and not theirs.
     */
    private void requireVisibleCollection(UUID userId, UUID collectionId) {
        Collection collection = collectionRepository
                .findById(collectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Collection not found: " + collectionId));
        boolean owned = collection.getOwnerId().equals(userId);
        if (collection.getVisibility() == Visibility.PRIVATE && !owned) {
            throw new ResourceNotFoundException("Collection not found: " + collectionId);
        }
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
