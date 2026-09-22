package com.dannest.post;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dannest.collection.Collection;
import com.dannest.collection.CollectionRepository;
import com.dannest.collection.Visibility;
import com.dannest.comment.CommentRepository;
import com.dannest.common.AggregateCount;
import com.dannest.common.BadRequestException;
import com.dannest.common.ForbiddenException;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.follow.CollectionFollowRepository;
import com.dannest.membership.CollectionMembership;
import com.dannest.membership.CollectionMembershipRepository;
import com.dannest.notification.NotificationService;
import com.dannest.post.dto.CreatePostRequest;
import com.dannest.post.dto.UpdatePostRequest;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class PostServiceTest {

    @Mock private PostRepository postRepository;
    @Mock private PostMediaRepository postMediaRepository;
    @Mock private PostLikeRepository postLikeRepository;
    @Mock private CommentRepository commentRepository;
    @Mock private CollectionRepository collectionRepository;
    @Mock private UserRepository userRepository;
    @Mock private CollectionFollowRepository collectionFollowRepository;
    @Mock private CollectionMembershipRepository membershipRepository;
    @Mock private NotificationService notificationService;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private TrendingScoreService trendingScoreService;

    private PostService postService;

    @BeforeEach
    void setUp() {
        postService = new PostService(
                postRepository, postMediaRepository, postLikeRepository, commentRepository, collectionRepository,
                userRepository, collectionFollowRepository, membershipRepository, notificationService,
                redisTemplate, new ObjectMapper(), trendingScoreService);
    }

    private Collection collection(UUID id, UUID ownerId, Visibility visibility) {
        Collection c = Collection.builder().ownerId(ownerId).name("C").visibility(visibility).build();
        ReflectionTestUtils.setField(c, "id", id);
        return c;
    }

    private User user(UUID id) {
        User u = User.forProvider("dan", "dan@example.com", "GOOGLE", "s", null);
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    private Post post(UUID id, UUID collectionId, UUID authorId) {
        Post p = Post.builder().collectionId(collectionId).authorId(authorId).title("t").build();
        ReflectionTestUtils.setField(p, "id", id);
        return p;
    }

    /** Stubs the batched lookups toResponses() needs so mapping a post to a response doesn't NPE. */
    private void stubMapping(Collection collection, User author) {
        when(postMediaRepository.findByPostIdInOrderByDisplayOrder(any())).thenReturn(List.of());
        when(postLikeRepository.countByPostIds(any())).thenReturn(List.of());
        when(commentRepository.countByPostIds(any())).thenReturn(List.of());
        when(postLikeRepository.findLikedPostIds(any(), any())).thenReturn(List.of());
        when(collectionRepository.findAllById(any())).thenReturn(List.of(collection));
        when(userRepository.findAllById(any())).thenReturn(List.of(author));
    }

    // ----- create -----

    @Test
    void canOnlyPostToACollectionYouOwn() {
        UUID collectionId = UUID.randomUUID();
        Collection collection = collection(collectionId, UUID.randomUUID(), Visibility.PUBLIC);
        when(collectionRepository.findById(collectionId)).thenReturn(Optional.of(collection));

        var request = new CreatePostRequest(collectionId, "Title", null, null);
        assertThatThrownBy(() -> postService.create(UUID.randomUUID(), request)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void creatingAPostNotifiesFollowersAndEvictsTheFeedCache() {
        UUID ownerId = UUID.randomUUID();
        UUID collectionId = UUID.randomUUID();
        UUID followerId = UUID.randomUUID();
        Collection collection = collection(collectionId, ownerId, Visibility.PUBLIC);
        when(collectionRepository.findById(collectionId)).thenReturn(Optional.of(collection));
        when(postRepository.save(any())).thenAnswer(inv -> {
            Post p = inv.getArgument(0);
            ReflectionTestUtils.setField(p, "id", UUID.randomUUID());
            return p;
        });
        when(collectionFollowRepository.findFollowerIdByCollectionId(collectionId)).thenReturn(List.of(followerId));
        when(redisTemplate.keys(any())).thenReturn(java.util.Set.of());
        stubMapping(collection, user(ownerId));

        postService.create(ownerId, new CreatePostRequest(collectionId, "Title", "Body", null));

        verify(notificationService).notify(eq(followerId), eq(ownerId), eq(com.dannest.notification.NotificationType.NEW_POST), eq(collectionId), any(), any());
        verify(notificationService).publishActivity(eq(ownerId), eq(com.dannest.notification.ActivityType.POST_CREATED), eq(collectionId), any(), any());
        verify(redisTemplate).keys("feed:posts:v1:*");
    }

    // ----- update -----

    @Test
    void blankTitleIsRejectedOnUpdate() {
        UUID authorId = UUID.randomUUID();
        UUID postId = UUID.randomUUID();
        Post post = post(postId, UUID.randomUUID(), authorId);
        when(postRepository.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));

        assertThatThrownBy(() -> postService.update(authorId, postId, new UpdatePostRequest(null, "   ", null, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void onlyTheAuthorCanUpdateAPost() {
        UUID postId = UUID.randomUUID();
        Post post = post(postId, UUID.randomUUID(), UUID.randomUUID());
        when(postRepository.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));

        assertThatThrownBy(() -> postService.update(UUID.randomUUID(), postId, new UpdatePostRequest(null, "New", null, null)))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void providingImagesOnUpdateReplacesThemWholesale() {
        UUID authorId = UUID.randomUUID();
        UUID postId = UUID.randomUUID();
        UUID collectionId = UUID.randomUUID();
        Post post = post(postId, collectionId, authorId);
        when(postRepository.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
        stubMapping(collection(collectionId, authorId, Visibility.PUBLIC), user(authorId));

        postService.update(authorId, postId, new UpdatePostRequest(null, null, null, List.of()));

        verify(postMediaRepository).deleteByPostId(postId);
        verify(postMediaRepository).flush();
    }

    // ----- delete -----

    @Test
    void deletingAPostSoftDeletesItAndRemovesItFromTrending() {
        UUID authorId = UUID.randomUUID();
        UUID postId = UUID.randomUUID();
        Post post = post(postId, UUID.randomUUID(), authorId);
        when(postRepository.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));

        postService.delete(authorId, postId);

        assertThat(post.isDeleted()).isTrue();
        verify(trendingScoreService).remove(postId);
    }

    // ----- like / unlike -----

    @Test
    void likingAPostTwiceIsANoOpTheSecondTime() {
        UUID userId = UUID.randomUUID();
        UUID postId = UUID.randomUUID();
        UUID collectionId = UUID.randomUUID();
        Post post = post(postId, collectionId, UUID.randomUUID());
        when(postRepository.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
        when(collectionRepository.findById(collectionId)).thenReturn(Optional.of(collection(collectionId, UUID.randomUUID(), Visibility.PUBLIC)));
        when(postLikeRepository.existsByPostIdAndUserId(postId, userId)).thenReturn(true);

        postService.like(userId, postId);

        verify(postLikeRepository, never()).save(any());
        verify(trendingScoreService, never()).incrementLike(any());
    }

    @Test
    void likingForTheFirstTimeSavesNotifiesAndBumpsTrending() {
        UUID userId = UUID.randomUUID();
        UUID authorId = UUID.randomUUID();
        UUID postId = UUID.randomUUID();
        UUID collectionId = UUID.randomUUID();
        Post post = post(postId, collectionId, authorId);
        when(postRepository.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
        when(collectionRepository.findById(collectionId)).thenReturn(Optional.of(collection(collectionId, UUID.randomUUID(), Visibility.PUBLIC)));
        when(postLikeRepository.existsByPostIdAndUserId(postId, userId)).thenReturn(false);

        postService.like(userId, postId);

        verify(postLikeRepository).save(any());
        verify(trendingScoreService).incrementLike(postId);
        verify(notificationService).notify(eq(authorId), eq(userId), eq(com.dannest.notification.NotificationType.POST_LIKED), eq(collectionId), eq(postId), any());
        verify(notificationService).publishActivity(eq(userId), eq(com.dannest.notification.ActivityType.POST_LIKED), eq(collectionId), eq(postId), any());
    }

    @Test
    void unlikingRemovesTheLikeAndDecrementsTrending() {
        UUID userId = UUID.randomUUID();
        UUID postId = UUID.randomUUID();
        UUID collectionId = UUID.randomUUID();
        Post post = post(postId, collectionId, UUID.randomUUID());
        when(postRepository.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
        when(collectionRepository.findById(collectionId)).thenReturn(Optional.of(collection(collectionId, UUID.randomUUID(), Visibility.PUBLIC)));

        postService.unlike(userId, postId);

        verify(postLikeRepository).deleteByPostIdAndUserId(postId, userId);
        verify(trendingScoreService).decrementLike(postId);
    }

    // ----- visibility -----

    @Test
    void privatePostsAre404ForANonOwnerNonAuthor() {
        UUID postId = UUID.randomUUID();
        UUID collectionId = UUID.randomUUID();
        Post post = post(postId, collectionId, UUID.randomUUID());
        when(postRepository.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
        when(collectionRepository.findById(collectionId)).thenReturn(Optional.of(collection(collectionId, UUID.randomUUID(), Visibility.PRIVATE)));

        assertThatThrownBy(() -> postService.get(UUID.randomUUID(), postId)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void membersOnlyPostsAreVisibleToAnActiveMember() {
        UUID postId = UUID.randomUUID();
        UUID collectionId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        Post post = post(postId, collectionId, UUID.randomUUID());
        Collection collection = collection(collectionId, UUID.randomUUID(), Visibility.MEMBERS_ONLY);
        CollectionMembership membership = CollectionMembership.builder()
                .userId(viewerId).collectionId(collectionId).grantedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600)).build();
        when(postRepository.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
        when(collectionRepository.findById(collectionId)).thenReturn(Optional.of(collection));
        when(membershipRepository.findByUserIdAndCollectionIdAndRevokedAtIsNull(viewerId, collectionId))
                .thenReturn(Optional.of(membership));
        stubMapping(collection, user(post.getAuthorId()));

        assertThat(postService.get(viewerId, postId)).isNotNull();
    }

    @Test
    void membersOnlyPostsAre404ForANonMember() {
        UUID postId = UUID.randomUUID();
        UUID collectionId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        Post post = post(postId, collectionId, UUID.randomUUID());
        Collection collection = collection(collectionId, UUID.randomUUID(), Visibility.MEMBERS_ONLY);
        when(postRepository.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
        when(collectionRepository.findById(collectionId)).thenReturn(Optional.of(collection));
        when(membershipRepository.findByUserIdAndCollectionIdAndRevokedAtIsNull(viewerId, collectionId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> postService.get(viewerId, postId)).isInstanceOf(ResourceNotFoundException.class);
    }

    // ----- listTrending -----

    @Test
    void trendingReturnsEmptyWithoutQueryingWhenTheLeaderboardIsEmpty() {
        when(trendingScoreService.top(10)).thenReturn(List.of());

        assertThat(postService.listTrending(UUID.randomUUID(), 10)).isEmpty();
        verify(postRepository, never()).findAllById(any());
    }

    @Test
    void trendingFiltersOutPostsTheViewerCannotSee() {
        UUID visiblePostId = UUID.randomUUID();
        UUID hiddenPostId = UUID.randomUUID();
        UUID visibleCollectionId = UUID.randomUUID();
        UUID hiddenCollectionId = UUID.randomUUID();
        Post visible = post(visiblePostId, visibleCollectionId, UUID.randomUUID());
        Post hidden = post(hiddenPostId, hiddenCollectionId, UUID.randomUUID());
        Collection visibleCollection = collection(visibleCollectionId, UUID.randomUUID(), Visibility.PUBLIC);
        Collection hiddenCollection = collection(hiddenCollectionId, UUID.randomUUID(), Visibility.PRIVATE);
        when(trendingScoreService.top(10)).thenReturn(List.of(visiblePostId, hiddenPostId));
        when(postRepository.findAllById(List.of(visiblePostId, hiddenPostId))).thenReturn(List.of(visible, hidden));
        when(collectionRepository.findById(visibleCollectionId)).thenReturn(Optional.of(visibleCollection));
        when(collectionRepository.findById(hiddenCollectionId)).thenReturn(Optional.of(hiddenCollection));
        stubMapping(visibleCollection, user(visible.getAuthorId()));

        var result = postService.listTrending(UUID.randomUUID(), 10);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo(visiblePostId);
    }

    // ----- list / feed cache -----

    @Test
    void aCacheMissPopulatesTheFeedCache() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(any())).thenReturn(null);
        var page = new org.springframework.data.domain.PageImpl<Post>(List.of());
        when(postRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(PageRequest.class)))
                .thenReturn(page);

        postService.list(UUID.randomUUID(), PostScope.FEED, null, null, PageRequest.of(0, 20));

        verify(valueOps).set(any(), any(), any(java.time.Duration.class));
    }

    @Test
    void aCacheHitSkipsTheDatabaseEntirely() throws Exception {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        String cachedJson = new ObjectMapper().writeValueAsString(
                new java.util.LinkedHashMap<String, Object>() {{
                    put("postIds", List.of());
                    put("totalElements", 0);
                    put("totalPages", 0);
                    put("last", true);
                }});
        when(valueOps.get(any())).thenReturn(cachedJson);

        postService.list(UUID.randomUUID(), PostScope.FEED, null, null, PageRequest.of(0, 20));

        verify(postRepository, never()).findAll(any(org.springframework.data.jpa.domain.Specification.class), any(PageRequest.class));
    }
}
