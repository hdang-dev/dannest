package com.dannest.collection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.dannest.collection.dto.CreateCollectionRequest;
import com.dannest.collection.dto.UpdateCollectionRequest;
import com.dannest.common.BadRequestException;
import com.dannest.common.ForbiddenException;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.membership.CollectionMembershipRepository;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class CollectionServiceTest {

    @Mock
    private CollectionRepository collectionRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private CollectionMembershipRepository membershipRepository;

    @InjectMocks
    private CollectionService collectionService;

    private void mockOwner(UUID ownerId) {
        User owner = User.forProvider("dan", "dan@example.com", "GOOGLE", "s", null);
        ReflectionTestUtils.setField(owner, "id", ownerId);
        when(userRepository.findAllById(any())).thenReturn(List.of(owner));
    }

    @Test
    void membersOnlyRequiresAPositivePrice() {
        var request = new CreateCollectionRequest("C", null, Visibility.MEMBERS_ONLY, null, null, null, null);

        assertThatThrownBy(() -> collectionService.create(UUID.randomUUID(), request))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void aPriceIsRejectedOnANonMembersOnlyCollection() {
        var request = new CreateCollectionRequest("C", null, Visibility.PUBLIC, 500, null, null, null);

        assertThatThrownBy(() -> collectionService.create(UUID.randomUUID(), request))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void creatingWithACoverRequiresACoverUrl() {
        var request = new CreateCollectionRequest("C", null, Visibility.PUBLIC, null, "media-1", null, null);
        UUID ownerId = UUID.randomUUID();

        assertThatThrownBy(() -> collectionService.create(ownerId, request))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void createsAValidPublicCollection() {
        var request = new CreateCollectionRequest("C", "desc", null, null, null, null, null);
        UUID ownerId = UUID.randomUUID();
        when(collectionRepository.save(any())).thenAnswer(inv -> {
            Collection saved = inv.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", UUID.randomUUID());
            return saved;
        });
        mockOwner(ownerId);

        var response = collectionService.create(ownerId, request);

        assertThat(response.visibility()).isEqualTo(Visibility.PUBLIC);
    }

    @Test
    void membersOnlyTypeCanNeverBeChangedAfterCreation() {
        UUID ownerId = UUID.randomUUID();
        Collection collection = Collection.builder()
                .ownerId(ownerId).name("C").visibility(Visibility.MEMBERS_ONLY).priceCents(500).build();
        ReflectionTestUtils.setField(collection, "id", UUID.randomUUID());
        when(collectionRepository.findById(collection.getId())).thenReturn(Optional.of(collection));

        assertThatThrownBy(() -> collectionService.update(
                ownerId, collection.getId(),
                new UpdateCollectionRequest(null, null, Visibility.PUBLIC, null, null, null, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void togglingBetweenPublicAndPrivateIsAllowed() {
        UUID ownerId = UUID.randomUUID();
        Collection collection = Collection.builder()
                .ownerId(ownerId).name("C").visibility(Visibility.PUBLIC).build();
        ReflectionTestUtils.setField(collection, "id", UUID.randomUUID());
        when(collectionRepository.findById(collection.getId())).thenReturn(Optional.of(collection));
        mockOwner(ownerId);

        collectionService.update(
                ownerId, collection.getId(),
                new UpdateCollectionRequest(null, null, Visibility.PRIVATE, null, null, null, null));

        assertThat(collection.getVisibility()).isEqualTo(Visibility.PRIVATE);
    }

    @Test
    void onlyTheOwnerCanUpdateACollection() {
        Collection collection = Collection.builder()
                .ownerId(UUID.randomUUID()).name("C").visibility(Visibility.PUBLIC).build();
        ReflectionTestUtils.setField(collection, "id", UUID.randomUUID());
        when(collectionRepository.findById(collection.getId())).thenReturn(Optional.of(collection));

        assertThatThrownBy(() -> collectionService.update(
                UUID.randomUUID(), collection.getId(),
                new UpdateCollectionRequest("new name", null, null, null, null, null, null)))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void archivingAndUnarchivingToggleTheArchivedTimestamp() {
        UUID ownerId = UUID.randomUUID();
        Collection collection = Collection.builder().ownerId(ownerId).name("C").build();
        ReflectionTestUtils.setField(collection, "id", UUID.randomUUID());
        when(collectionRepository.findById(collection.getId())).thenReturn(Optional.of(collection));

        collectionService.archive(ownerId, collection.getId());
        assertThat(collection.isArchived()).isTrue();

        collectionService.unarchive(ownerId, collection.getId());
        assertThat(collection.isArchived()).isFalse();
    }

    @Test
    void privateCollectionsAreHiddenFromNonOwnersAs404() {
        Collection collection = Collection.builder()
                .ownerId(UUID.randomUUID()).name("C").visibility(Visibility.PRIVATE).build();
        ReflectionTestUtils.setField(collection, "id", UUID.randomUUID());
        when(collectionRepository.findById(collection.getId())).thenReturn(Optional.of(collection));

        assertThatThrownBy(() -> collectionService.get(UUID.randomUUID(), collection.getId()))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
