package com.dannest.comment;

import com.dannest.common.AggregateCount;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommentRepository extends JpaRepository<Comment, UUID> {

    /**
     * A post's comments (top-level and replies alike, flat — the frontend groups replies
     * under their parent). Author and their avatar are joined in to avoid N+1 lookups; both
     * are to-one associations so the join doesn't multiply rows under pagination.
     */
    @Query(value = "select c from Comment c join fetch c.author a left join fetch a.avatar"
            + " where c.post.id = :postId",
            countQuery = "select count(c) from Comment c where c.post.id = :postId")
    Page<Comment> findByPostId(@Param("postId") UUID postId, Pageable pageable);

    /** Comment totals for a set of posts, in one grouped query (feed comment counts). */
    @Query("select c.post.id as id, count(c) as count from Comment c"
            + " where c.post.id in :postIds group by c.post.id")
    List<AggregateCount> countByPostIds(@Param("postIds") Collection<UUID> postIds);
}
