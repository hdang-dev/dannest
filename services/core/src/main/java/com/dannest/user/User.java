package com.dannest.user;

import com.dannest.common.BaseEntity;
import com.dannest.media.Media;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class User extends BaseEntity {

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    /** Null for OAuth users (they authenticate via a provider, not a password). */
    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    /** Nullable — set after the avatar Media row exists (avoids a circular NOT NULL). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "avatar_media_id")
    private Media avatar;

    @Column(columnDefinition = "text")
    private String bio;

    /** OAuth provider, e.g. "GOOGLE". Null for password users. */
    @Column(length = 20)
    private String provider;

    /** The provider's stable user id (Google `sub`). */
    @Column(name = "provider_id", length = 255)
    private String providerId;

    /** Profile picture URL from the provider (e.g. Google photo). */
    @Column(name = "avatar_url", length = 1024)
    private String avatarUrl;

    protected User() {
    }

    public User(String username, String email, String passwordHash) {
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
    }

    /** Create a user authenticated through an external provider (e.g. Google). */
    public static User forProvider(String username, String email, String provider, String providerId, String avatarUrl) {
        User u = new User();
        u.username = username;
        u.email = email;
        u.provider = provider;
        u.providerId = providerId;
        u.avatarUrl = avatarUrl;
        return u;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public Media getAvatar() {
        return avatar;
    }

    public void setAvatar(Media avatar) {
        this.avatar = avatar;
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }

    public String getProvider() {
        return provider;
    }

    public String getProviderId() {
        return providerId;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }
}
