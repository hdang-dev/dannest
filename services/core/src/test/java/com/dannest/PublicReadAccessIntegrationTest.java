package com.dannest;

import static org.assertj.core.api.Assertions.assertThat;

import com.dannest.collection.Collection;
import com.dannest.collection.CollectionRepository;
import com.dannest.collection.Visibility;
import com.dannest.post.Post;
import com.dannest.post.PostRepository;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
import com.jayway.jsonpath.JsonPath;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * The security + controller layer for the web app's public pages, end to end over real
 * HTTP without a token: the four opened read endpoints serve PUBLIC content, hide
 * everything else as a 404, and every other endpoint still demands a login.
 *
 * <p>A real server (not MockMvc) on purpose: a 404 is rendered by forwarding to
 * {@code /error}, which goes back through Spring Security — MockMvc skips that forward,
 * so it can't catch an anonymous 404 being turned into a 401 there.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class PublicReadAccessIntegrationTest {

    @Autowired
    private TestRestTemplate http;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CollectionRepository collectionRepository;

    @Autowired
    private PostRepository postRepository;

    private User owner;
    private Collection publicCollection;
    private Collection privateCollection;
    private Collection membersOnlyCollection;
    private Collection archivedCollection;
    private Post publicPost;
    private Post privatePost;

    @BeforeEach
    void setUp() {
        // Committed for real (the server answers on its own threads), so names are unique
        // per run instead of being rolled back.
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        owner = userRepository.save(User.forProvider(
                "owner-" + suffix, "owner-" + suffix + "@example.com", "GOOGLE", UUID.randomUUID().toString(), null));
        publicCollection = save("Public", Visibility.PUBLIC, null);
        privateCollection = save("Private", Visibility.PRIVATE, null);
        membersOnlyCollection = save("Members", Visibility.MEMBERS_ONLY, 500);
        archivedCollection = save("Archived", Visibility.PUBLIC, null);
        archivedCollection.archive();
        collectionRepository.save(archivedCollection);

        publicPost = postRepository.save(Post.builder()
                .collectionId(publicCollection.getId()).authorId(owner.getId()).title("Public post").build());
        privatePost = postRepository.save(Post.builder()
                .collectionId(privateCollection.getId()).authorId(owner.getId()).title("Private post").build());
    }

    private Collection save(String name, Visibility visibility, Integer priceCents) {
        return collectionRepository.save(Collection.builder()
                .ownerId(owner.getId()).name(name).visibility(visibility).priceCents(priceCents).build());
    }

    private ResponseEntity<String> get(String path, Object... vars) {
        return http.getForEntity(path, String.class, vars);
    }

    @Test
    void anonymousCanReadAPublicCollectionItsPostsAndComments() {
        var collection = get("/api/v1/collections/{id}", publicCollection.getId());
        assertThat(collection.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat((String) JsonPath.read(collection.getBody(), "$.name")).isEqualTo("Public");

        var posts = get("/api/v1/collections/{id}/posts", publicCollection.getId());
        assertThat(posts.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat((String) JsonPath.read(posts.getBody(), "$.content[0].title")).isEqualTo("Public post");
        assertThat((Boolean) JsonPath.read(posts.getBody(), "$.content[0].likedByMe")).isFalse();

        assertThat(get("/api/v1/posts/{id}/comments", publicPost.getId()).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void anonymousCanReadAProfileWithoutItsEmail() {
        var profile = get("/api/v1/users/{id}", owner.getId());

        assertThat(profile.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat((String) JsonPath.read(profile.getBody(), "$.username")).isEqualTo(owner.getUsername());
        assertThat((Object) JsonPath.read(profile.getBody(), "$.email")).isNull();
    }

    @Test
    void anonymousGets404NotA401ForPrivateMembersOnlyAndArchivedCollections() {
        for (Collection hidden : new Collection[] {privateCollection, membersOnlyCollection, archivedCollection}) {
            assertThat(get("/api/v1/collections/{id}", hidden.getId()).getStatusCode())
                    .isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(get("/api/v1/collections/{id}/posts", hidden.getId()).getStatusCode())
                    .isEqualTo(HttpStatus.NOT_FOUND);
        }
        assertThat(get("/api/v1/posts/{id}/comments", privatePost.getId()).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(get("/api/v1/users/{id}", UUID.randomUUID()).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void everyOtherEndpointStillRequiresALogin() {
        assertThat(get("/api/v1/posts").getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(get("/api/v1/posts/trending").getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(get("/api/v1/collections").getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(get("/api/v1/collections/{id}/follow", publicCollection.getId()).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
