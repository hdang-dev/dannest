package com.dannest.common;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import java.time.Instant;
import lombok.Getter;

/**
 * Base for entities that support soft-delete: {@code deletedAt} set means hidden (not
 * gone) — the row stays for referential integrity and is recoverable via {@link #restore()}.
 */
@Getter
@MappedSuperclass
public abstract class SoftDeletableEntity extends BaseEntity {

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public boolean isDeleted() {
        return deletedAt != null;
    }

    /** Soft-delete (idempotent). */
    public void softDelete() {
        if (deletedAt == null) {
            deletedAt = Instant.now();
        }
    }

    /** Restore a previously soft-deleted row. */
    public void restore() {
        deletedAt = null;
    }
}
