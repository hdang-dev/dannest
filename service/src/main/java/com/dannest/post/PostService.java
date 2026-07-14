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
import com.dannest.media.Media;
import com.dannest.media.MediaRepository;
import com.dannest.media.dto.CropDto;
import com.dannest.post.dto.CreatePostRequest;
import com.dannest.post.dto.PostMediaResponse;
import com.dannest.post.dto.PostResponse;
import com.dannest.post.dto.UpdatePostRequest;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The full lifecycle of a post: create (with ordered images), read (single + feed /
 * mine / by-collection lists), partial update, delete, and like / unlike. Mutations are
 * scoped to the caller — only a post's author may edit or delete it, and posts can only
 * be created in (or moved to) a collection the caller owns. Visibility is inherited from
 * the owning collection.
 */
@Service
@Transactional
public class PostService {

    private final PostRepository postRepository;
    private final PostMediaRepository postMediaRepository;
    private final PostLikeRepository postLikeRepository;
    private final CommentRepository commentRepository;
    private final CollectionRepository collectionRepository;
    private final MediaRepository mediaRepository;
    private final UserRepository userRepository;

    public PostService(
            PostRepository postRepository,
            PostMediaRepository postMediaRepository,
            PostLikeRepository postLikeRepository,
            CommentRepository commentRepository,
            CollectionRepository collectionRepository,
            MediaRepository mediaRepository,
            UserRepository userRepository) {
        this.postRepository = postRepository;
        this.postMediaRepository = postMediaRepository;
        this.postLikeRepository = postLikeRepository;
        this.commentRepository = commentRepository;
        this.collectionRepository = collectionRepository;
        this.mediaRepository = mediaRepository;
        this.userRepository = userRepository;
    }

    public PostResponse create(UUID userId, CreatePostRequest request) {
        Collection collection = resolveOwnedCollection(userId, request.collectionId());
        User author = userRepository.getReferenceById(userId);

        Post post = postRepository.save(new Post(collection, author, request.title().trim(), trimToNull(request.content())));
        attachMedia(userId, post, request.mediaIds());
        return toResponse(post, userId);
    }

    /**
     * List posts with filters:
     * <ul>
     *   <li>{@code collectionId} set — posts in that collection (if the caller may view it); scope is ignored</li>
     *   <li>{@code scope=FEED} — posts in every user's public, non-archived collections</li>
     *   <li>{@code scope=MINE} — posts the caller authored</li>
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
            filters.add((root, cq, cb) -> cb.equal(root.get("collection").get("id"), collectionId));
        } else if (scope == PostScope.MINE) {
            filters.add((root, cq, cb) -> cb.equal(root.get("author").get("id"), userId));
        } else {
            // FEED: public, non-archived collections only.
            filters.add((root, cq, cb) -> cb.equal(root.get("collection").get("visibility"), Visibility.PUBLIC));
            filters.add((root, cq, cb) -> cb.isNull(root.get("collection").get("archivedAt")));
        }
        if (q != null) {
            String like = "%" + q.toLowerCase() + "%";
            filters.add((root, cq, cb) -> cb.like(cb.lower(root.get("title")), like));
        }

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
            post.setCollection(resolveOwnedCollection(userId, request.collectionId()));
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
        // Providing mediaIds replaces the post's images wholesale.
        if (request.mediaIds() != null) {
            postMediaRepository.deleteByPost_Id(post.getId());
            postMediaRepository.flush();
            attachMedia(userId, post, request.mediaIds());
        }
        return toResponse(post, userId);
    }

    /** Delete a post (its images, likes, and comments cascade in the database). */
    public void delete(UUID userId, UUID postId) {
        Post post = findOwned(userId, postId);
        postRepository.delete(post);
    }

    /** Like a post the caller can view (idempotent — a second like is a no-op). */
    public void like(UUID userId, UUID postId) {
        Post post = findVisible(userId, postId);
        if (!postLikeRepository.existsByPost_IdAndUser_Id(postId, userId)) {
            postLikeRepository.save(new PostLike(post, userRepository.getReferenceById(userId)));
        }
    }

    /** Remove the caller's like (idempotent). */
    public void unlike(UUID userId, UUID postId) {
        findVisible(userId, postId);
        postLikeRepository.deleteByPost_IdAndUser_Id(postId, userId);
    }

    // ----- mapping -------------------------------------------------------------------

    private PostResponse toResponse(Post post, UUID userId) {
        return toResponses(List.of(post), userId).get(0);
    }

    /**
     * Map a page of posts to responses, batching the images and social counts into a
     * handful of grouped queries rather than several per post.
     */
    private List<PostResponse> toResponses(List<Post> posts, UUID userId) {
        if (posts.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = posts.stream().map(Post::getId).toList();

        Map<UUID, List<PostMediaResponse>> imagesByPost = new LinkedHashMap<>();
        for (PostMedia pm : postMediaRepository.findWithMediaByPostIds(ids)) {
            imagesByPost
                    .computeIfAbsent(pm.getPost().getId(), k -> new ArrayList<>())
                    .add(PostMediaResponse.from(pm));
        }
        Map<UUID, Long> likeCounts = toCountMap(postLikeRepository.countByPostIds(ids));
        Map<UUID, Long> commentCounts = toCountMap(commentRepository.countByPostIds(ids));
        Set<UUID> likedByMe = new HashSet<>(postLikeRepository.findLikedPostIds(userId, ids));

        return posts.stream()
                .map(p -> {
                    Collection c = p.getCollection();
                    User a = p.getAuthor();
                    Media authorAvatar = a.getAvatar();
                    return new PostResponse(
                            p.getId(),
                            c.getId(),
                            c.getName(),
                            c.getVisibility(),
                            a.getId(),
                            a.getUsername(),
                            authorAvatar != null ? authorAvatar.getUrl() : null,
                            authorAvatar != null ? CropDto.from(authorAvatar.getCrop()) : null,
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

    // ----- helpers -------------------------------------------------------------------

    /** Resolve the mediaIds (owned by the caller) into ordered {@link PostMedia} rows. */
    private void attachMedia(UUID userId, Post post, List<UUID> mediaIds) {
        if (mediaIds == null) {
            return;
        }
        int order = 0;
        Set<UUID> seen = new HashSet<>();
        for (UUID mediaId : mediaIds) {
            if (mediaId == null || !seen.add(mediaId)) {
                continue; // ignore nulls and duplicates (the (post, media) pair is unique)
            }
            Media media = resolveOwnedMedia(userId, mediaId);
            postMediaRepository.save(new PostMedia(post, media, order++));
        }
    }

    /** Load a post the caller may view: its collection is PUBLIC, or the caller owns it / authored the post. */
    private Post findVisible(UUID userId, UUID postId) {
        Post post = findById(postId);
        Collection c = post.getCollection();
        boolean owned = c.getOwner().getId().equals(userId) || post.getAuthor().getId().equals(userId);
        if (c.getVisibility() == Visibility.PRIVATE && !owned) {
            // Hide the existence of posts in private collections from non-owners.
            throw new ResourceNotFoundException("Post not found: " + postId);
        }
        return post;
    }

    /** Load a post the caller must have authored to mutate; 404 if missing, 403 if not theirs. */
    private Post findOwned(UUID userId, UUID postId) {
        Post post = findById(postId);
        if (!post.getAuthor().getId().equals(userId)) {
            throw new ForbiddenException("You do not own this post");
        }
        return post;
    }

    private Post findById(UUID postId) {
        return postRepository
                .findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found: " + postId));
    }

    private Collection resolveOwnedCollection(UUID userId, UUID collectionId) {
        Collection collection = collectionRepository
                .findById(collectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Collection not found: " + collectionId));
        if (!collection.getOwner().getId().equals(userId)) {
            throw new ForbiddenException("You can only post to a collection you own");
        }
        return collection;
    }

    /** Ensure the caller may view a collection (for its post list); 404 if private and not theirs. */
    private void requireVisibleCollection(UUID userId, UUID collectionId) {
        Collection collection = collectionRepository
                .findById(collectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Collection not found: " + collectionId));
        boolean owned = collection.getOwner().getId().equals(userId);
        if (collection.getVisibility() == Visibility.PRIVATE && !owned) {
            throw new ResourceNotFoundException("Collection not found: " + collectionId);
        }
    }

    private Media resolveOwnedMedia(UUID userId, UUID mediaId) {
        Media media = mediaRepository
                .findById(mediaId)
                .orElseThrow(() -> new ResourceNotFoundException("Media not found: " + mediaId));
        if (!media.getOwner().getId().equals(userId)) {
            throw new ForbiddenException("You do not own this media");
        }
        return media;
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
