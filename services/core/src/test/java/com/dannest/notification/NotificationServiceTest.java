package com.dannest.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dannest.collection.Collection;
import com.dannest.collection.CollectionRepository;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.event.DannestEvent;
import com.dannest.event.EventPublisher;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private CollectionRepository collectionRepository;

    @Mock
    private EventPublisher eventPublisher;

    @InjectMocks
    private NotificationService notificationService;

    private User actor(UUID id) {
        User user = User.forProvider("dan", "dan@example.com", "GOOGLE", "sub-1", null);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private Collection collection(UUID id) {
        Collection c = Collection.builder().ownerId(UUID.randomUUID()).name("My Collection").build();
        ReflectionTestUtils.setField(c, "id", id);
        return c;
    }

    @Test
    void neverNotifiesSomeoneAboutTheirOwnAction() {
        UUID sameUser = UUID.randomUUID();

        notificationService.notify(sameUser, sameUser, NotificationType.POST_LIKED, UUID.randomUUID(), null, null);

        verify(eventPublisher, never()).publish(any());
    }

    @Test
    void publishesANotificationWithTheActorAndCollectionDisplayData() {
        UUID recipientId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID collectionId = UUID.randomUUID();
        when(userRepository.findById(actorId)).thenReturn(Optional.of(actor(actorId)));
        when(collectionRepository.findById(collectionId)).thenReturn(Optional.of(collection(collectionId)));

        notificationService.notify(recipientId, actorId, NotificationType.FOLLOW, collectionId, null, null);

        ArgumentCaptor<DannestEvent> captor = ArgumentCaptor.forClass(DannestEvent.class);
        verify(eventPublisher).publish(captor.capture());
        DannestEvent event = captor.getValue();
        assertEvent(event, "FOLLOW", recipientId, actorId, collectionId);
    }

    @Test
    void notifyThrowsIfTheActorDoesNotExist() {
        UUID actorId = UUID.randomUUID();
        when(userRepository.findById(actorId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> notificationService.notify(
                UUID.randomUUID(), actorId, NotificationType.FOLLOW, UUID.randomUUID(), null, null))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void activityIsPublishedEvenThoughItHasNoOtherRecipient() {
        UUID actorId = UUID.randomUUID();
        UUID collectionId = UUID.randomUUID();
        when(userRepository.findById(actorId)).thenReturn(Optional.of(actor(actorId)));
        when(collectionRepository.findById(collectionId)).thenReturn(Optional.of(collection(collectionId)));

        notificationService.publishActivity(actorId, ActivityType.POST_CREATED, collectionId, null, null);

        ArgumentCaptor<DannestEvent> captor = ArgumentCaptor.forClass(DannestEvent.class);
        verify(eventPublisher).publish(captor.capture());
        DannestEvent event = captor.getValue();
        // recipientId is set to actorId itself for activity events — there's no other recipient concept.
        assertEvent(event, "ACTIVITY_POST_CREATED", actorId, actorId, collectionId);
    }

    private static void assertEvent(
            DannestEvent event, String type, UUID recipientId, UUID actorId, UUID collectionId) {
        assertThat(event.eventType()).isEqualTo(type);
        assertThat(event.recipientId()).isEqualTo(recipientId);
        assertThat(event.actorId()).isEqualTo(actorId);
        assertThat(event.collectionId()).isEqualTo(collectionId);
    }
}
