package com.dannest.user;

import com.dannest.common.BadRequestException;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.user.dto.UpdateUserRequest;
import com.dannest.user.dto.UserProfileResponse;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reading a user's profile and updating the caller's own profile (username, bio, avatar). */
@Service
@Transactional
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    /** A user's profile, as visible to {@code viewerId} (email is owner-only). */
    @Transactional(readOnly = true)
    public UserProfileResponse get(UUID viewerId, UUID userId) {
        User user = findById(userId);
        return UserProfileResponse.from(user, viewerId.equals(userId));
    }

    public UserProfileResponse updateMe(UUID userId, UpdateUserRequest request) {
        User user = findById(userId);

        if (request.username() != null) {
            String username = request.username().trim();
            if (username.isEmpty()) {
                throw new BadRequestException("Username cannot be blank");
            }
            if (!username.equals(user.getUsername()) && userRepository.existsByUsernameAndIdNot(username, userId)) {
                throw new BadRequestException("Username is already taken");
            }
            user.setUsername(username);
        }
        if (request.bio() != null) {
            user.setBio(request.bio());
        }
        // clearAvatar removes the avatar; otherwise a new avatarMediaId (+ its url/crop
        // snapshot, sent by the caller since Core can't look media up itself) replaces it.
        if (Boolean.TRUE.equals(request.clearAvatar())) {
            user.setAvatarMediaId(null);
            user.setAvatarMediaUrl(null);
        } else if (request.avatarMediaId() != null) {
            if (request.avatarMediaUrl() == null || request.avatarMediaUrl().isBlank()) {
                throw new BadRequestException("avatarMediaUrl is required when setting avatarMediaId");
            }
            user.setAvatarMediaId(request.avatarMediaId());
            user.setAvatarMediaUrl(request.avatarMediaUrl());
            if (request.avatarCrop() != null) {
                user.setAvatarCrop(request.avatarCrop().toEntity());
            }
        }
        return UserProfileResponse.from(user, true);
    }

    private User findById(UUID userId) {
        return userRepository
                .findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
    }
}
