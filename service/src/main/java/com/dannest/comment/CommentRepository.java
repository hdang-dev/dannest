package com.dannest.comment;

import com.dannest.common.AggregateCount;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommentRepository extends JpaRepository<Comment, UUID> {

    /** Comment totals for a set of posts, in one grouped query (feed comment counts). */
    @Query("select c.post.id as id, count(c) as count from Comment c"
            + " where c.post.id in :postIds group by c.post.id")
    List<AggregateCount> countByPostIds(@Param("postIds") Collection<UUID> postIds);
}
