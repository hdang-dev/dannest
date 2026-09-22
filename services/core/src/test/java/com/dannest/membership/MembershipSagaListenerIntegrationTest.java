package com.dannest.membership;

import static org.assertj.core.api.Assertions.assertThat;

import com.dannest.collection.Collection;
import com.dannest.collection.CollectionRepository;
import com.dannest.collection.Visibility;
import com.dannest.membership.event.PurchaseInitiatedEvent;
import com.dannest.outbox.OutboxEventRepository;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs the real saga listener against a real Postgres: no mocking of the inbox claim,
 * the membership write, or the outbox write — the same three-table dance production runs.
 */
@SpringBootTest
@Transactional
class MembershipSagaListenerIntegrationTest {

    @Autowired
    private MembershipSagaListener listener;

    @Autowired
    private CollectionRepository collectionRepository;

    @Autowired
    private CollectionMembershipRepository membershipRepository;

    @Autowired
    private OutboxEventRepository outboxEventRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Test
    void grantsExactlyOneMembershipEvenIfTheChargedEventIsRedelivered() throws Exception {
        User owner = userRepository.save(User.forProvider("owner", "owner@example.com", "GOOGLE", UUID.randomUUID().toString(), null));
        User buyer = userRepository.save(User.forProvider("buyer", "buyer@example.com", "GOOGLE", UUID.randomUUID().toString(), null));
        Collection collection = collectionRepository.save(Collection.builder()
                .ownerId(owner.getId())
                .name("A members-only collection")
                .visibility(Visibility.MEMBERS_ONLY)
                .priceCents(500)
                .build());
        UUID buyerId = buyer.getId();
        String purchaseId = UUID.randomUUID().toString();
        PurchaseInitiatedEvent event =
                new PurchaseInitiatedEvent(UUID.randomUUID(), purchaseId, buyerId, collection.getId(), 500);
        Message message = new Message(objectMapper.writeValueAsBytes(event), new MessageProperties());

        listener.onPurchaseInitiated(message);
        listener.onPurchaseInitiated(message); // the same delivery, twice

        assertThat(membershipRepository.findByUserIdAndCollectionIdAndRevokedAtIsNull(buyerId, collection.getId()))
                .isPresent();
        // A broken idempotency claim would let processPurchase run twice, writing a second
        // outbox row (the redelivery would hit "already an active member" and reject) —
        // scoped to this purchase's own id so leftover data from other runs can't hide it.
        assertThat(outboxEventRepository.findAll().stream().filter(e -> e.getAggregateId().equals(purchaseId)))
                .hasSize(1);
    }
}
