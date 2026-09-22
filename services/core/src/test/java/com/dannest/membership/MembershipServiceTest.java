package com.dannest.membership;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dannest.collection.Collection;
import com.dannest.collection.CollectionRepository;
import com.dannest.collection.Visibility;
import com.dannest.membership.event.MembershipActivatedEvent;
import com.dannest.membership.event.MembershipRejectedEvent;
import com.dannest.membership.event.PurchaseInitiatedEvent;
import com.dannest.outbox.OutboxWriter;
import java.time.Instant;
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
class MembershipServiceTest {

    @Mock
    private CollectionRepository collectionRepository;

    @Mock
    private CollectionMembershipRepository membershipRepository;

    @Mock
    private OutboxWriter outboxWriter;

    @InjectMocks
    private MembershipService membershipService;

    private Collection membersOnlyCollection(UUID ownerId, int priceCents) {
        Collection c = Collection.builder()
                .ownerId(ownerId).name("C").visibility(Visibility.MEMBERS_ONLY).priceCents(priceCents).build();
        ReflectionTestUtils.setField(c, "id", UUID.randomUUID());
        return c;
    }

    private PurchaseInitiatedEvent purchaseFor(UUID collectionId, UUID buyerId, int priceCents) {
        return new PurchaseInitiatedEvent(UUID.randomUUID(), "purchase-1", buyerId, collectionId, priceCents);
    }

    @Test
    void rejectsAPurchaseOfAnUnknownCollection() {
        UUID collectionId = UUID.randomUUID();
        when(collectionRepository.findById(collectionId)).thenReturn(Optional.empty());

        membershipService.processPurchase(purchaseFor(collectionId, UUID.randomUUID(), 500));

        assertRejectedWith("Collection not found");
        verify(membershipRepository, never()).save(any());
    }

    @Test
    void rejectsAPurchaseOfANonMembersOnlyCollection() {
        Collection collection = Collection.builder().ownerId(UUID.randomUUID()).name("C").visibility(Visibility.PUBLIC).build();
        ReflectionTestUtils.setField(collection, "id", UUID.randomUUID());
        when(collectionRepository.findById(collection.getId())).thenReturn(Optional.of(collection));

        membershipService.processPurchase(purchaseFor(collection.getId(), UUID.randomUUID(), 500));

        assertRejectedWith("Collection is not members-only");
    }

    @Test
    void rejectsAPurchaseOfAnArchivedCollection() {
        Collection collection = membersOnlyCollection(UUID.randomUUID(), 500);
        collection.archive();
        when(collectionRepository.findById(collection.getId())).thenReturn(Optional.of(collection));

        membershipService.processPurchase(purchaseFor(collection.getId(), UUID.randomUUID(), 500));

        assertRejectedWith("Collection is archived");
    }

    @Test
    void ownerCannotBuyTheirOwnCollection() {
        UUID ownerId = UUID.randomUUID();
        Collection collection = membersOnlyCollection(ownerId, 500);
        when(collectionRepository.findById(collection.getId())).thenReturn(Optional.of(collection));

        membershipService.processPurchase(purchaseFor(collection.getId(), ownerId, 500));

        assertRejectedWith("Owner cannot buy their own collection");
    }

    @Test
    void rejectsAPriceMismatch() {
        Collection collection = membersOnlyCollection(UUID.randomUUID(), 500);
        when(collectionRepository.findById(collection.getId())).thenReturn(Optional.of(collection));

        membershipService.processPurchase(purchaseFor(collection.getId(), UUID.randomUUID(), 400));

        assertRejectedWith("Price mismatch");
    }

    @Test
    void rejectsARepurchaseOfAnAlreadyActiveMembership() {
        UUID buyerId = UUID.randomUUID();
        Collection collection = membersOnlyCollection(UUID.randomUUID(), 500);
        CollectionMembership active = CollectionMembership.builder()
                .userId(buyerId).collectionId(collection.getId())
                .grantedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(3600)).build();
        when(collectionRepository.findById(collection.getId())).thenReturn(Optional.of(collection));
        when(membershipRepository.findByUserIdAndCollectionIdAndRevokedAtIsNull(buyerId, collection.getId()))
                .thenReturn(Optional.of(active));

        membershipService.processPurchase(purchaseFor(collection.getId(), buyerId, 500));

        assertRejectedWith("Already an active member");
    }

    @Test
    void grantsAValidPurchaseAndPublishesTheGrantedEvent() {
        UUID buyerId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        Collection collection = membersOnlyCollection(ownerId, 500);
        when(collectionRepository.findById(collection.getId())).thenReturn(Optional.of(collection));
        when(membershipRepository.findByUserIdAndCollectionIdAndRevokedAtIsNull(buyerId, collection.getId()))
                .thenReturn(Optional.empty());

        membershipService.processPurchase(purchaseFor(collection.getId(), buyerId, 500));

        verify(membershipRepository).save(any(CollectionMembership.class));
        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(outboxWriter).write(eq("MEMBERSHIP_PURCHASE"), eq("purchase-1"), eq("core.membership.granted"), payloadCaptor.capture());
        assertThat(payloadCaptor.getValue()).isInstanceOfSatisfying(MembershipActivatedEvent.class, e -> {
            assertThat(e.purchaseId()).isEqualTo("purchase-1");
            assertThat(e.ownerId()).isEqualTo(ownerId);
        });
    }

    @Test
    void revokingAnUnknownPurchaseIsJustLoggedNotThrown() {
        // Must not throw.
        when(membershipRepository.findByPurchaseId("missing")).thenReturn(Optional.empty());

        membershipService.revokeForSettleFailure("missing");

        verify(membershipRepository, never()).save(any());
    }

    @Test
    void revokingAnActiveMembershipMarksItRevoked() {
        CollectionMembership membership = CollectionMembership.builder()
                .userId(UUID.randomUUID()).collectionId(UUID.randomUUID())
                .purchaseId("purchase-1").grantedAt(Instant.now()).build();
        when(membershipRepository.findByPurchaseId("purchase-1")).thenReturn(Optional.of(membership));

        membershipService.revokeForSettleFailure("purchase-1");

        assertThat(membership.getRevokedAt()).isNotNull();
        verify(membershipRepository).save(membership);
    }

    private void assertRejectedWith(String reason) {
        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(outboxWriter).write(eq("MEMBERSHIP_PURCHASE"), eq("purchase-1"), eq("core.membership.rejected"), payloadCaptor.capture());
        assertThat(payloadCaptor.getValue()).isInstanceOfSatisfying(
                MembershipRejectedEvent.class, e -> assertThat(e.reason()).isEqualTo(reason));
    }
}
