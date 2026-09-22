package com.dannest.post;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dannest.collection.Collection;
import com.dannest.collection.CollectionRepository;
import com.dannest.collection.Visibility;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.post.dto.PostResponse;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Exercises PostService.list()'s real Specification-built queries and visibility rules
 * against a real Postgres — the parts a mocked unit test can't meaningfully verify, since
 * the filtering logic lives inside JPA query predicates, not plain Java branches.
 */
@SpringBootTest
@Transactional
class PostServiceVisibilityIntegrationTest {

    @Autowired
    private PostService postService;

    @Autowired
    private CollectionRepository collectionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PostRepository postRepository;

    private User author;
    private Collection publicCollection;
    private Collection privateCollection;
    private Collection archivedCollection;

    @BeforeEach
    void setUp() {
        author = userRepository.save(User.forProvider("author", "author@example.com", "GOOGLE", UUID.randomUUID().toString(), null));
        publicCollection = collectionRepository.save(
                Collection.builder().ownerId(author.getId()).name("Public").visibility(Visibility.PUBLIC).build());
        privateCollection = collectionRepository.save(
                Collection.builder().ownerId(author.getId()).name("Private").visibility(Visibility.PRIVATE).build());
        archivedCollection = collectionRepository.save(
                Collection.builder().ownerId(author.getId()).name("Archived").visibility(Visibility.PUBLIC).build());
        archivedCollection.archive();
        collectionRepository.save(archivedCollection);

        postRepository.save(Post.builder().collectionId(publicCollection.getId()).authorId(author.getId()).title("Public post").build());
        postRepository.save(Post.builder().collectionId(privateCollection.getId()).authorId(author.getId()).title("Private post").build());
        postRepository.save(Post.builder().collectionId(archivedCollection.getId()).authorId(author.getId()).title("Archived post").build());
    }

    @Test
    void theFeedExcludesPrivateAndArchivedCollectionsPosts() {
        var page = postService.list(UUID.randomUUID(), PostScope.FEED, null, null, PageRequest.of(0, 20));

        assertThat(page.content()).extracting(PostResponse::title).containsExactly("Public post");
    }

    @Test
    void mineReturnsEveryPostTheCallerAuthoredRegardlessOfVisibility() {
        var page = postService.list(author.getId(), PostScope.MINE, null, null, PageRequest.of(0, 20));

        assertThat(page.content()).extracting(PostResponse::title)
                .containsExactlyInAnyOrder("Public post", "Private post", "Archived post");
    }

    @Test
    void aStrangerGetsA404ForAPostInAPrivateCollection() {
        var privatePost = postRepository.findAll().stream()
                .filter(p -> p.getCollectionId().equals(privateCollection.getId())).findFirst().orElseThrow();

        assertThatThrownBy(() -> postService.get(UUID.randomUUID(), privatePost.getId()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void theOwnerCanStillSeeTheirOwnPrivatePost() {
        var privatePost = postRepository.findAll().stream()
                .filter(p -> p.getCollectionId().equals(privateCollection.getId())).findFirst().orElseThrow();

        assertThat(postService.get(author.getId(), privatePost.getId()).title()).isEqualTo("Private post");
    }
}
