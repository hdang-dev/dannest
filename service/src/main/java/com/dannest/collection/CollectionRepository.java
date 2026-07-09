package com.dannest.collection;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CollectionRepository extends JpaRepository<Collection, UUID> {

    Page<Collection> findByOwnerId(UUID ownerId, Pageable pageable);
}
