package com.dannest.follow;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CollectionFollowRepository extends JpaRepository<CollectionFollow, UUID> {

    boolean existsByFollowerIdAndCollectionId(UUID followerId, UUID collectionId);

    void deleteByFollowerIdAndCollectionId(UUID followerId, UUID collectionId);

    /** Collections the caller follows — the service batch-loads the collections themselves. */
    Page<CollectionFollow> findByFollowerId(UUID followerId, Pageable pageable);

    /** Everyone following a collection — the fan-out list for a new-post notification. Derived
     * query naming only controls the WHERE clause, not the SELECT list, so this needs an
     * explicit projection — a bare method name here silently selects full entities instead. */
    @Query("select f.followerId from CollectionFollow f where f.collectionId = :collectionId")
    List<UUID> findFollowerIdByCollectionId(@Param("collectionId") UUID collectionId);
}
