package com.dannest.comment;

import com.dannest.collection.Collection;
import com.dannest.collection.CollectionRepository;
import com.dannest.collection.Visibility;
import com.dannest.comment.dto.CommentResponse;
import com.dannest.comment.dto.CreateCommentRequest;
import com.dannest.comment.dto.UpdateCommentRequest;
import com.dannest.common.BadRequestException;
import com.dannest.common.CropDto;
import com.dannest.common.ForbiddenException;
import com.dannest.common.PagedResponse;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.notification.NotificationService;
import com.dannest.notification.NotificationType;
import com.dannest.post.Post;
import com.dannest.post.PostRepository;
import com.dannest.post.TrendingScoreService;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The full lifecycle of a comment: list (oldest-first, flat — the frontend groups replies
 * under their parent), create (top-level or a reply), update, and delete. A comment can
 * only be read on / added to a post the caller may view, and only its author may edit or
 * delete it.
 */
@Service
@Transactional
@RequiredArgsConstructor
public class CommentService {

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;
    private final CollectionRepository collectionRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final TrendingScoreService trendingScoreService;

    @Transactional(readOnly = true)
    public PagedResponse<CommentResponse> list(UUID userId, UUID postId, Pageable pageable) {
        findVisiblePost(userId, postId);
        Pageable effective = pageable.getSort().isSorted()
                ? pageable
                : PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                        Sort.by(Sort.Direction.ASC, "createdAt"));
        Page<Comment> page = commentRepository.findByPostIdAndDeletedAtIsNull(postId, effective);
        return new PagedResponse<>(
                toResponses(page.getContent()), page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages(), page.isLast());
    }

    public CommentResponse create(UUID userId, UUID postId, CreateCommentRequest request) {
        Post post = findVisiblePost(userId, postId);

        Comment parent = null;
        if (request.parentCommentId() != null) {
            parent = commentRepository
                    .findByIdAndDeletedAtIsNull(request.parentCommentId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Comment not found: " + request.parentCommentId()));
            if (!parent.getPostId().equals(postId)) {
                throw new BadRequestException("Parent comment does not belong to this post");
            }
        }

        Comment comment = commentRepository.save(Comment.builder()
                .postId(postId)
                .authorId(userId)
                .parentCommentId(parent != null ? parent.getId() : null)
                .content(request.content().trim())
                .build());
        if (parent != null) {
            notificationService.notify(
                    parent.getAuthorId(), userId, NotificationType.COMMENT_REPLY,
                    post.getCollectionId(), postId, comment.getId());
        }
        trendingScoreService.incrementComment(postId);
        return toResponse(comment);
    }

    public CommentResponse update(UUID userId, UUID commentId, UpdateCommentRequest request) {
        Comment comment = findOwned(userId, commentId);
        comment.setContent(request.content().trim());
        return toResponse(comment);
    }

    /** Soft-delete a comment and every reply beneath it (mirrors the prior DB cascade, just recoverable). */
    public void delete(UUID userId, UUID commentId) {
        Comment comment = findOwned(userId, commentId);
        softDeleteWithReplies(comment);
    }

    private void softDeleteWithReplies(Comment comment) {
        comment.softDelete();
        for (Comment reply : commentRepository.findByParentCommentIdAndDeletedAtIsNull(comment.getId())) {
            softDeleteWithReplies(reply);
        }
    }

    // ----- mapping -------------------------------------------------------------------

    private CommentResponse toResponse(Comment c) {
        return toResponses(List.of(c)).get(0);
    }

    /**
     * Map a batch of comments to responses, batching the author lookup into a single
     * grouped query rather than one per comment. Author avatars are the author's own
     * denormalized snapshot — no media lookup needed.
     */
    private List<CommentResponse> toResponses(List<Comment> comments) {
        if (comments.isEmpty()) {
            return List.of();
        }
        Set<UUID> authorIds = comments.stream().map(Comment::getAuthorId).collect(Collectors.toSet());
        Map<UUID, User> authorsById = new LinkedHashMap<>();
        for (User u : userRepository.findAllById(authorIds)) {
            authorsById.put(u.getId(), u);
        }

        return comments.stream()
                .map(c -> {
                    User a = authorsById.get(c.getAuthorId());
                    return new CommentResponse(
                            c.getId(),
                            c.getPostId(),
                            a.getId(),
                            a.getUsername(),
                            a.getAvatarMediaUrl(),
                            a.getAvatarMediaUrl() != null ? CropDto.from(a.getAvatarCrop()) : null,
                            c.getParentCommentId(),
                            c.getContent(),
                            c.getCreatedAt(),
                            c.getUpdatedAt());
                })
                .toList();
    }

    // ----- helpers -------------------------------------------------------------------

    /** Load a post the caller may view: its collection is PUBLIC, or the caller owns it / authored the post. */
    private Post findVisiblePost(UUID userId, UUID postId) {
        Post post = postRepository
                .findByIdAndDeletedAtIsNull(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found: " + postId));
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

    /** Load a comment the caller must have authored to mutate; 404 if missing, 403 if not theirs. */
    private Comment findOwned(UUID userId, UUID commentId) {
        Comment comment = commentRepository
                .findByIdAndDeletedAtIsNull(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found: " + commentId));
        if (!comment.getAuthorId().equals(userId)) {
            throw new ForbiddenException("You do not own this comment");
        }
        return comment;
    }
}
