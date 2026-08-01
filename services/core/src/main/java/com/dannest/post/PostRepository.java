package com.dannest.post;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface PostRepository
        extends JpaRepository<Post, UUID>, JpaSpecificationExecutor<Post> {
    // Dynamic filtering (scope / collection / search) is built with Specifications
    // in PostService, so only present filters become SQL predicates — mirroring
    // CollectionRepository, and avoiding nullable bind parameters Postgres can't type.
}
