package com.dannest.post;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PostMediaRepository extends JpaRepository<PostMedia, UUID> {

    /** A batch of posts' image links, ordered — callers group by post id (relative order is preserved per post). */
    List<PostMedia> findByPostIdInOrderByDisplayOrder(Collection<UUID> postIds);

    /** Remove every image link for a post — used when replacing a post's images. */
    void deleteByPostId(UUID postId);
}
