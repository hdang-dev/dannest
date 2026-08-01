package com.dannest.post;

import com.dannest.common.AggregateCount;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostLikeRepository extends JpaRepository<PostLike, UUID> {

    boolean existsByPost_IdAndUser_Id(UUID postId, UUID userId);

    void deleteByPost_IdAndUser_Id(UUID postId, UUID userId);

    /** Like totals for a set of posts, in one grouped query. */
    @Query("select pl.post.id as id, count(pl) as count from PostLike pl"
            + " where pl.post.id in :postIds group by pl.post.id")
    List<AggregateCount> countByPostIds(@Param("postIds") Collection<UUID> postIds);

    /** Which of these posts the given user has liked — to flag {@code likedByMe}. */
    @Query("select pl.post.id from PostLike pl"
            + " where pl.user.id = :userId and pl.post.id in :postIds")
    List<UUID> findLikedPostIds(@Param("userId") UUID userId, @Param("postIds") Collection<UUID> postIds);
}
