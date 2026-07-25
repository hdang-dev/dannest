package com.dannest.follow;

import com.dannest.collection.dto.CollectionResponse;
import com.dannest.common.PagedResponse;
import com.dannest.follow.dto.FollowStatusResponse;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class FollowController {

    private final FollowService followService;

    public FollowController(FollowService followService) {
        this.followService = followService;
    }

    /** Whether the caller follows this collection — drives the follow/unfollow toggle. */
    @GetMapping("/collections/{id}/follow")
    public FollowStatusResponse status(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return new FollowStatusResponse(followService.isFollowing(currentUserId(jwt), id));
    }

    @PostMapping("/collections/{id}/follow")
    public ResponseEntity<Void> follow(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        followService.follow(currentUserId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/collections/{id}/follow")
    public ResponseEntity<Void> unfollow(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        followService.unfollow(currentUserId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    /** Collections the caller follows ("My Subscriptions"). */
    @GetMapping("/me/subscriptions")
    public PagedResponse<CollectionResponse> subscriptions(@AuthenticationPrincipal Jwt jwt, Pageable pageable) {
        return followService.listFollowed(currentUserId(jwt), pageable);
    }

    private static UUID currentUserId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
