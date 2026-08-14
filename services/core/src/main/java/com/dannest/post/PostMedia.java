package com.dannest.post;

import com.dannest.common.BaseEntity;
import com.dannest.media.Media;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Links a Post to its images (ordered). A post has zero or many. */
@Entity
@Table(
    name = "post_media",
    uniqueConstraints = @UniqueConstraint(name = "uq_post_media", columnNames = {"post_id", "media_id"})
)
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostMedia extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "media_id", nullable = false)
    private Media media;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;
}
