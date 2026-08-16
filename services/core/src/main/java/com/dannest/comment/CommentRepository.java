package com.dannest.comment;

import com.dannest.common.AggregateCount;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommentRepository extends JpaRepository<Comment, UUID> {

    /**
     * A post's comments (top-level and replies alike, flat — the frontend groups replies
     * under their parent). The service batch-loads authors/avatars separately.
     */
    Page<Comment> findByPostIdAndDeletedAtIsNull(UUID postId, Pageable pageable);

    /** Comment totals for a set of posts, in one grouped query (feed comment counts). */
    @Query("select c.postId as id, count(c) as count from Comment c"
            + " where c.postId in :postIds and c.deletedAt is null group by c.postId")
    List<AggregateCount> countByPostIds(@Param("postIds") Collection<UUID> postIds);

    /** An active (not soft-deleted) comment — single-comment lookups (reply-to/update/delete) go through this. */
    Optional<Comment> findByIdAndDeletedAtIsNull(UUID id);

    /** A comment's direct, still-active replies — used to cascade a soft-delete down the reply tree. */
    List<Comment> findByParentCommentIdAndDeletedAtIsNull(UUID parentCommentId);
}
