package com.dannest.user;

import com.dannest.common.BadRequestException;
import com.dannest.common.ForbiddenException;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.media.Media;
import com.dannest.media.MediaRepository;
import com.dannest.user.dto.UpdateUserRequest;
import com.dannest.user.dto.UserProfileResponse;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reading a user's profile and updating the caller's own profile (username, bio, avatar). */
@Service
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final MediaRepository mediaRepository;

    public UserService(UserRepository userRepository, MediaRepository mediaRepository) {
        this.userRepository = userRepository;
        this.mediaRepository = mediaRepository;
    }

    /** A user's profile, as visible to {@code viewerId} (email is owner-only). */
    @Transactional(readOnly = true)
    public UserProfileResponse get(UUID viewerId, UUID userId) {
        return UserProfileResponse.from(findById(userId), viewerId.equals(userId));
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
        // clearAvatar removes the avatar; otherwise a new avatarMediaId replaces it.
        if (Boolean.TRUE.equals(request.clearAvatar())) {
            user.setAvatar(null);
        } else if (request.avatarMediaId() != null) {
            user.setAvatar(resolveOwnedAvatar(userId, request.avatarMediaId()));
        }
        return UserProfileResponse.from(user, true);
    }

    private User findById(UUID userId) {
        return userRepository
                .findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
    }

    /** Resolve an avatar media id, enforcing that the caller owns the referenced asset. */
    private Media resolveOwnedAvatar(UUID userId, UUID mediaId) {
        Media media = mediaRepository
                .findById(mediaId)
                .orElseThrow(() -> new ResourceNotFoundException("Media not found: " + mediaId));
        if (!media.getOwner().getId().equals(userId)) {
            throw new ForbiddenException("You do not own this media");
        }
        return media;
    }
}
