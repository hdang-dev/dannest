package com.dannest.post;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * A Redis sorted set (`trending:posts`, member = post id, score = weighted activity) ranking
 * posts by likes/comments. Updated synchronously wherever {@link PostService}/
 * {@link com.dannest.comment.CommentService} already mutate likes/comments/posts — this never
 * goes through RabbitMQ, since the activity that feeds it already happens inside Core's own
 * request path.
 *
 * <p>The +1/+2 weights below are placeholders, not derived from any real activity data — tune
 * them once the leaderboard has real traffic to look at. There's also no time decay yet, so
 * scores only ever accumulate; a known, accepted limitation for a first pass.
 */
@Service
public class TrendingScoreService {

    private static final String KEY = "trending:posts";

    private final StringRedisTemplate redis;

    public TrendingScoreService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void incrementLike(UUID postId) {
        redis.opsForZSet().incrementScore(KEY, postId.toString(), 1);
    }

    public void decrementLike(UUID postId) {
        redis.opsForZSet().incrementScore(KEY, postId.toString(), -1);
    }

    public void incrementComment(UUID postId) {
        redis.opsForZSet().incrementScore(KEY, postId.toString(), 2);
    }

    /** Post deleted — drop it from the leaderboard entirely. */
    public void remove(UUID postId) {
        redis.opsForZSet().remove(KEY, postId.toString());
    }

    /** The top-ranked post ids, highest score first. */
    public List<UUID> top(int limit) {
        Set<String> ids = redis.opsForZSet().reverseRange(KEY, 0, limit - 1);
        if (ids == null) {
            return List.of();
        }
        return ids.stream().map(UUID::fromString).toList();
    }
}
