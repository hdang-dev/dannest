package com.dannest.user;

import com.dannest.user.dto.UpdateUserRequest;
import com.dannest.user.dto.UserProfileResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    /** A user's profile (email is only included when viewing your own). */
    @GetMapping("/{id}")
    public UserProfileResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return userService.get(currentUserId(jwt), id);
    }

    /** Update the caller's own profile. */
    @PatchMapping("/me")
    public UserProfileResponse updateMe(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdateUserRequest request) {
        return userService.updateMe(currentUserId(jwt), request);
    }

    private static UUID currentUserId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
