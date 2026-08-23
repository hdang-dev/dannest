package com.dannest.activity;

import com.dannest.activity.dto.ActivityResponse;
import com.dannest.common.PagedResponse;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/activity")
public class ActivityController {

    private final ActivityService activityService;

    public ActivityController(ActivityService activityService) {
        this.activityService = activityService;
    }

    /** The caller's own activity, newest-first, paginated. */
    @GetMapping
    public PagedResponse<ActivityResponse> list(@AuthenticationPrincipal Jwt jwt, Pageable pageable) {
        return activityService.list(currentUserId(jwt), pageable);
    }

    private static UUID currentUserId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
