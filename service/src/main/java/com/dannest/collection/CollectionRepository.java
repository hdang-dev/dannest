package com.dannest.collection;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface CollectionRepository
        extends JpaRepository<Collection, UUID>, JpaSpecificationExecutor<Collection> {
    // Dynamic filtering (scope / visibility / search) is built with Specifications
    // in CollectionService, so only present filters become SQL predicates. This
    // avoids nullable bind parameters, which Postgres can't type-infer.
}
