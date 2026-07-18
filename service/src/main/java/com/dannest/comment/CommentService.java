package com.dannest.comment;

import com.dannest.collection.Collection;
import com.dannest.collection.Visibility;
import com.dannest.comment.dto.CommentResponse;
import com.dannest.comment.dto.CreateCommentRequest;
import com.dannest.comment.dto.UpdateCommentRequest;
import com.dannest.common.BadRequestException;
import com.dannest.common.ForbiddenException;
import com.dannest.common.PagedResponse;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.media.Media;
import com.dannest.media.dto.CropDto;
import com.dannest.post.Post;
import com.dannest.post.PostRepository;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
import java.util.UUID;
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
public class CommentService {

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;
    private final UserRepository userRepository;

    public CommentService(
            CommentRepository commentRepository, PostRepository postRepository, UserRepository userRepository) {
        this.commentRepository = commentRepository;
        this.postRepository = postRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public PagedResponse<CommentResponse> list(UUID userId, UUID postId, Pageable pageable) {
        findVisiblePost(userId, postId);
        Pageable effective = pageable.getSort().isSorted()
                ? pageable
                : PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                        Sort.by(Sort.Direction.ASC, "createdAt"));
        Page<Comment> page = commentRepository.findByPostId(postId, effective);
        return PagedResponse.of(page, CommentService::toResponse);
    }

    public CommentResponse create(UUID userId, UUID postId, CreateCommentRequest request) {
        Post post = findVisiblePost(userId, postId);

        Comment parent = null;
        if (request.parentCommentId() != null) {
            parent = commentRepository
                    .findById(request.parentCommentId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Comment not found: " + request.parentCommentId()));
            if (!parent.getPost().getId().equals(postId)) {
                throw new BadRequestException("Parent comment does not belong to this post");
            }
        }

        User author = userRepository.getReferenceById(userId);
        Comment comment = commentRepository.save(new Comment(post, author, parent, request.content().trim()));
        return toResponse(comment);
    }

    public CommentResponse update(UUID userId, UUID commentId, UpdateCommentRequest request) {
        Comment comment = findOwned(userId, commentId);
        comment.setContent(request.content().trim());
        return toResponse(comment);
    }

    /** Delete a comment (its replies cascade in the database). */
    public void delete(UUID userId, UUID commentId) {
        Comment comment = findOwned(userId, commentId);
        commentRepository.delete(comment);
    }

    // ----- mapping -------------------------------------------------------------------

    private static CommentResponse toResponse(Comment c) {
        User a = c.getAuthor();
        Media avatar = a.getAvatar();
        Comment parent = c.getParent();
        return new CommentResponse(
                c.getId(),
                c.getPost().getId(),
                a.getId(),
                a.getUsername(),
                avatar != null ? avatar.getUrl() : null,
                avatar != null ? CropDto.from(avatar.getCrop()) : null,
                parent != null ? parent.getId() : null,
                c.getContent(),
                c.getCreatedAt(),
                c.getUpdatedAt());
    }

    // ----- helpers -------------------------------------------------------------------

    /** Load a post the caller may view: its collection is PUBLIC, or the caller owns it / authored the post. */
    private Post findVisiblePost(UUID userId, UUID postId) {
        Post post = postRepository
                .findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found: " + postId));
        Collection c = post.getCollection();
        boolean owned = c.getOwner().getId().equals(userId) || post.getAuthor().getId().equals(userId);
        if (c.getVisibility() == Visibility.PRIVATE && !owned) {
            // Hide the existence of posts in private collections from non-owners.
            throw new ResourceNotFoundException("Post not found: " + postId);
        }
        return post;
    }

    /** Load a comment the caller must have authored to mutate; 404 if missing, 403 if not theirs. */
    private Comment findOwned(UUID userId, UUID commentId) {
        Comment comment = commentRepository
                .findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found: " + commentId));
        if (!comment.getAuthor().getId().equals(userId)) {
            throw new ForbiddenException("You do not own this comment");
        }
        return comment;
    }
}
