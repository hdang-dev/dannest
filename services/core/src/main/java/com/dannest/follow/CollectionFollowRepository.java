package com.dannest.follow;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CollectionFollowRepository extends JpaRepository<CollectionFollow, UUID> {

    boolean existsByFollowerIdAndCollectionId(UUID followerId, UUID collectionId);

    void deleteByFollowerIdAndCollectionId(UUID followerId, UUID collectionId);

    /** Collections the caller follows — the service batch-loads the collections themselves. */
    Page<CollectionFollow> findByFollowerId(UUID followerId, Pageable pageable);

    /** Everyone following a collection — the fan-out list for a new-post notification. */
    List<UUID> findFollowerIdByCollectionId(UUID collectionId);
}
