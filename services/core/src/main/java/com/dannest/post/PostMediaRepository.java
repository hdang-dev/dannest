package com.dannest.post;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostMediaRepository extends JpaRepository<PostMedia, UUID> {

    /**
     * All image links for a set of posts, with the underlying {@link com.dannest.media.Media}
     * eagerly joined so the mapper can read url/crop without a query per row. Ordered by
     * display order; callers group by post id (relative order is preserved per post).
     */
    @Query("select pm from PostMedia pm join fetch pm.media"
            + " where pm.post.id in :postIds order by pm.displayOrder")
    List<PostMedia> findWithMediaByPostIds(@Param("postIds") Collection<UUID> postIds);

    /** Remove every image link for a post — used when replacing a post's images. */
    void deleteByPost_Id(UUID postId);
}
