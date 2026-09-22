package com.dannest.follow;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dannest.collection.Collection;
import com.dannest.collection.CollectionRepository;
import com.dannest.collection.CollectionService;
import com.dannest.collection.Visibility;
import com.dannest.common.BadRequestException;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.notification.NotificationService;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class FollowServiceTest {

    @Mock
    private CollectionFollowRepository followRepository;

    @Mock
    private CollectionRepository collectionRepository;

    @Mock
    private CollectionService collectionService;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private FollowService followService;

    private Collection collectionOwnedBy(UUID ownerId, Visibility visibility) {
        Collection c = Collection.builder().ownerId(ownerId).name("C").visibility(visibility).build();
        ReflectionTestUtils.setField(c, "id", UUID.randomUUID());
        return c;
    }

    @Test
    void cannotFollowYourOwnCollection() {
        UUID ownerId = UUID.randomUUID();
        Collection collection = collectionOwnedBy(ownerId, Visibility.PUBLIC);
        when(collectionRepository.findById(collection.getId())).thenReturn(Optional.of(collection));

        assertThatThrownBy(() -> followService.follow(ownerId, collection.getId()))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void cannotFollowAPrivateCollectionYouDoNotOwn() {
        Collection collection = collectionOwnedBy(UUID.randomUUID(), Visibility.PRIVATE);
        when(collectionRepository.findById(collection.getId())).thenReturn(Optional.of(collection));

        assertThatThrownBy(() -> followService.follow(UUID.randomUUID(), collection.getId()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void followingIsANoOpTheSecondTime() {
        Collection collection = collectionOwnedBy(UUID.randomUUID(), Visibility.PUBLIC);
        UUID followerId = UUID.randomUUID();
        when(collectionRepository.findById(collection.getId())).thenReturn(Optional.of(collection));
        when(followRepository.existsByFollowerIdAndCollectionId(followerId, collection.getId())).thenReturn(true);

        followService.follow(followerId, collection.getId());

        verify(followRepository, never()).save(any());
        verify(notificationService, never()).notify(any(), any(), any(), any(), any(), any());
    }

    @Test
    void followingForTheFirstTimeSavesAndNotifiesTheOwner() {
        Collection collection = collectionOwnedBy(UUID.randomUUID(), Visibility.PUBLIC);
        UUID followerId = UUID.randomUUID();
        when(collectionRepository.findById(collection.getId())).thenReturn(Optional.of(collection));
        when(followRepository.existsByFollowerIdAndCollectionId(followerId, collection.getId())).thenReturn(false);

        followService.follow(followerId, collection.getId());

        verify(followRepository).save(any());
        verify(notificationService).notify(
                collection.getOwnerId(), followerId, com.dannest.notification.NotificationType.FOLLOW,
                collection.getId(), null, null);
    }

    @Test
    void unfollowIsIdempotentAndJustDeletes() {
        UUID followerId = UUID.randomUUID();
        UUID collectionId = UUID.randomUUID();

        followService.unfollow(followerId, collectionId);

        verify(followRepository).deleteByFollowerIdAndCollectionId(followerId, collectionId);
    }
}
