package com.dannest.post;

import com.dannest.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
    name = "post_media",
    uniqueConstraints = @UniqueConstraint(name = "uq_post_media", columnNames = {"post_id", "media_id"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostMedia extends BaseEntity {

    @Column(name = "post_id", nullable = false)
    private UUID postId;

    @Column(name = "media_id", nullable = false)
    private UUID mediaId;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;
}
