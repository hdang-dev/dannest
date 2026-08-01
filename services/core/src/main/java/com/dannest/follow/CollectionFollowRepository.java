package com.dannest.follow;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CollectionFollowRepository extends JpaRepository<CollectionFollow, UUID> {

    boolean existsByFollower_IdAndCollection_Id(UUID followerId, UUID collectionId);

    void deleteByFollower_IdAndCollection_Id(UUID followerId, UUID collectionId);

    /** Collections the caller follows — collection and its owner joined in to avoid N+1. */
    @Query(value = "select f from CollectionFollow f join fetch f.collection c join fetch c.owner"
            + " where f.follower.id = :followerId",
            countQuery = "select count(f) from CollectionFollow f where f.follower.id = :followerId")
    Page<CollectionFollow> findByFollowerId(@Param("followerId") UUID followerId, Pageable pageable);

    /** Everyone following a collection — the fan-out list for a new-post notification. */
    @Query("select f.follower.id from CollectionFollow f where f.collection.id = :collectionId")
    List<UUID> findFollowerIdsByCollectionId(@Param("collectionId") UUID collectionId);
}
