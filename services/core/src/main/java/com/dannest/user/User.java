package com.dannest.user;

import com.dannest.common.BaseEntity;
import com.dannest.common.ImageCrop;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User extends BaseEntity {

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    /** Opaque reference into services/media — no FK, that service owns the asset's lifecycle. */
    @Column(name = "avatar_media_id")
    private UUID avatarMediaId;

    /** Denormalized snapshot of the media service's url/crop, copied at write time
     * (see docs/tech/architecture-flows.md's media-split notes). Never live-resolved. */
    @Column(name = "avatar_media_url", length = 1024)
    private String avatarMediaUrl;

    @Builder.Default
    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "x", column = @Column(name = "avatar_crop_x")),
        @AttributeOverride(name = "y", column = @Column(name = "avatar_crop_y")),
        @AttributeOverride(name = "width", column = @Column(name = "avatar_crop_width")),
        @AttributeOverride(name = "height", column = @Column(name = "avatar_crop_height")),
    })
    private ImageCrop avatarCrop = ImageCrop.full();

    @Column(columnDefinition = "text")
    private String bio;

    @Column(length = 20)
    private String provider;

    @Column(name = "provider_id", length = 255)
    private String providerId;

    /** The OAuth provider's picture — legacy/fallback only, never the profile photo. */
    @Column(name = "avatar_url", length = 1024)
    private String avatarUrl;

    public static User forProvider(String username, String email, String provider, String providerId, String avatarUrl) {
        return User.builder()
                .username(username)
                .email(email)
                .provider(provider)
                .providerId(providerId)
                .avatarUrl(avatarUrl)
                .build();
    }
}
