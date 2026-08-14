package com.dannest.media;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaRepository extends JpaRepository<Media, UUID> {

    /** An active (not soft-deleted) media asset — used everywhere a caller resolves an id to attach/mutate it. */
    Optional<Media> findByIdAndDeletedAtIsNull(UUID id);
}
