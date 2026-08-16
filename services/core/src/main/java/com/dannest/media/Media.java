package com.dannest.media;

import com.dannest.common.SoftDeletableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.EnumType;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "media")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Media extends SoftDeletableEntity {

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MediaSource source = MediaSource.UPLOAD;

    @Column(name = "storage_key", length = 512)
    private String storageKey;

    @Column(nullable = false, length = 1024)
    private String url;

    @Column(name = "mime_type", length = 100)
    private String mimeType;

    private Long size;

    private Integer width;

    private Integer height;

    @Builder.Default
    @Embedded
    private ImageCrop crop = ImageCrop.full();

    public static Media external(UUID ownerId, String url) {
        return Media.builder()
                .ownerId(ownerId)
                .source(MediaSource.EXTERNAL)
                .url(url)
                .build();
    }
}
