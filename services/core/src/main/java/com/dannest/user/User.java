package com.dannest.user;

import com.dannest.common.BaseEntity;
import com.dannest.media.Media;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User extends BaseEntity {

    @Column(nullable = false, unique = true, length = 50)
    @Setter
    private String username;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    /** Null for OAuth users (they authenticate via a provider, not a password). Never set today — no password-signup flow exists yet. */
    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    /** Nullable — set after the avatar Media row exists (avoids a circular NOT NULL). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "avatar_media_id")
    @Setter
    private Media avatar;

    @Column(columnDefinition = "text")
    @Setter
    private String bio;

    /** OAuth provider, e.g. "GOOGLE". Null for password users. */
    @Column(length = 20)
    private String provider;

    /** The provider's stable user id (Google `sub`). */
    @Column(name = "provider_id", length = 255)
    private String providerId;

    /** Profile picture URL from the provider (e.g. Google photo). */
    @Column(name = "avatar_url", length = 1024)
    @Setter
    private String avatarUrl;

    /** Create a user authenticated through an external provider (e.g. Google). */
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
