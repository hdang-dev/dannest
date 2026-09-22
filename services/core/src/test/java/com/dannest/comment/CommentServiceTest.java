package com.dannest.comment;

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
import com.dannest.comment.dto.CreateCommentRequest;
import com.dannest.comment.dto.UpdateCommentRequest;
import com.dannest.common.BadRequestException;
import com.dannest.common.ForbiddenException;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.notification.NotificationService;
import com.dannest.notification.NotificationType;
import com.dannest.post.Post;
import com.dannest.post.PostRepository;
import com.dannest.post.TrendingScoreService;
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
class CommentServiceTest {

    @Mock
    private CommentRepository commentRepository;

    @Mock
    private PostRepository postRepository;

    @Mock
    private CollectionRepository collectionRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private TrendingScoreService trendingScoreService;

    @InjectMocks
    private CommentService commentService;

    private Post post(UUID id, UUID collectionId, UUID authorId) {
        Post post = Post.builder().collectionId(collectionId).authorId(authorId).title("t").build();
        ReflectionTestUtils.setField(post, "id", id);
        return post;
    }

    private Collection publicCollection(UUID id, UUID ownerId) {
        Collection c = Collection.builder().ownerId(ownerId).name("C").visibility(Visibility.PUBLIC).build();
        ReflectionTestUtils.setField(c, "id", id);
        return c;
    }

    private void mockAuthor(UUID authorId) {
        User author = User.forProvider("dan", "dan@example.com", "GOOGLE", "s", null);
        ReflectionTestUtils.setField(author, "id", authorId);
        when(userRepository.findAllById(any())).thenReturn(List.of(author));
    }

    @Test
    void cannotCommentOnAPostInAPrivateCollectionYouDoNotOwn() {
        UUID postId = UUID.randomUUID();
        UUID collectionId = UUID.randomUUID();
        Post post = post(postId, collectionId, UUID.randomUUID());
        Collection privateCollection = Collection.builder()
                .ownerId(UUID.randomUUID()).name("C").visibility(Visibility.PRIVATE).build();
        ReflectionTestUtils.setField(privateCollection, "id", collectionId);
        when(postRepository.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
        when(collectionRepository.findById(collectionId)).thenReturn(Optional.of(privateCollection));

        assertThatThrownBy(() -> commentService.create(UUID.randomUUID(), postId, new CreateCommentRequest("hi", null)))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void topLevelCommentNotifiesNobodyButStillLogsTheActivity() {
        UUID postId = UUID.randomUUID();
        UUID collectionId = UUID.randomUUID();
        UUID authorId = UUID.randomUUID();
        Post post = post(postId, collectionId, UUID.randomUUID());
        when(postRepository.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
        when(collectionRepository.findById(collectionId)).thenReturn(Optional.of(publicCollection(collectionId, UUID.randomUUID())));
        when(commentRepository.save(any())).thenAnswer(inv -> {
            Comment c = inv.getArgument(0);
            ReflectionTestUtils.setField(c, "id", UUID.randomUUID());
            return c;
        });
        mockAuthor(authorId);

        commentService.create(authorId, postId, new CreateCommentRequest("hello", null));

        verify(notificationService, never()).notify(any(), any(), any(), any(), any(), any());
        verify(notificationService).publishActivity(
                eq(authorId), eq(com.dannest.notification.ActivityType.COMMENT_CREATED), eq(collectionId), eq(postId), any());
        verify(trendingScoreService).incrementComment(postId);
    }

    @Test
    void replyingNotifiesTheParentCommentsAuthor() {
        UUID postId = UUID.randomUUID();
        UUID collectionId = UUID.randomUUID();
        UUID authorId = UUID.randomUUID();
        UUID parentAuthorId = UUID.randomUUID();
        UUID parentId = UUID.randomUUID();
        Post post = post(postId, collectionId, UUID.randomUUID());
        Comment parent = Comment.builder().postId(postId).authorId(parentAuthorId).content("parent").build();
        ReflectionTestUtils.setField(parent, "id", parentId);
        when(postRepository.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
        when(collectionRepository.findById(collectionId)).thenReturn(Optional.of(publicCollection(collectionId, UUID.randomUUID())));
        when(commentRepository.findByIdAndDeletedAtIsNull(parentId)).thenReturn(Optional.of(parent));
        when(commentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        mockAuthor(authorId);

        commentService.create(authorId, postId, new CreateCommentRequest("reply", parentId));

        verify(notificationService).notify(
                eq(parentAuthorId), eq(authorId), eq(NotificationType.COMMENT_REPLY), eq(collectionId), eq(postId), any());
    }

    @Test
    void rejectsAReplyToACommentOnADifferentPost() {
        UUID postId = UUID.randomUUID();
        UUID otherPostId = UUID.randomUUID();
        UUID collectionId = UUID.randomUUID();
        UUID parentId = UUID.randomUUID();
        Post post = post(postId, collectionId, UUID.randomUUID());
        Comment parent = Comment.builder().postId(otherPostId).authorId(UUID.randomUUID()).content("x").build();
        ReflectionTestUtils.setField(parent, "id", parentId);
        when(postRepository.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
        when(collectionRepository.findById(collectionId)).thenReturn(Optional.of(publicCollection(collectionId, UUID.randomUUID())));
        when(commentRepository.findByIdAndDeletedAtIsNull(parentId)).thenReturn(Optional.of(parent));

        assertThatThrownBy(() -> commentService.create(
                UUID.randomUUID(), postId, new CreateCommentRequest("reply", parentId)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void onlyTheAuthorCanEditAComment() {
        UUID commentId = UUID.randomUUID();
        Comment comment = Comment.builder().postId(UUID.randomUUID()).authorId(UUID.randomUUID()).content("x").build();
        ReflectionTestUtils.setField(comment, "id", commentId);
        when(commentRepository.findByIdAndDeletedAtIsNull(commentId)).thenReturn(Optional.of(comment));

        assertThatThrownBy(() -> commentService.update(
                UUID.randomUUID(), commentId, new UpdateCommentRequest("edited")))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void deletingACommentSoftDeletesItAndEveryReplyBeneathIt() {
        UUID authorId = UUID.randomUUID();
        UUID commentId = UUID.randomUUID();
        UUID replyId = UUID.randomUUID();
        Comment comment = Comment.builder().postId(UUID.randomUUID()).authorId(authorId).content("x").build();
        ReflectionTestUtils.setField(comment, "id", commentId);
        Comment reply = Comment.builder().postId(UUID.randomUUID()).authorId(authorId).content("y").build();
        ReflectionTestUtils.setField(reply, "id", replyId);
        when(commentRepository.findByIdAndDeletedAtIsNull(commentId)).thenReturn(Optional.of(comment));
        when(commentRepository.findByParentCommentIdAndDeletedAtIsNull(commentId)).thenReturn(List.of(reply));
        when(commentRepository.findByParentCommentIdAndDeletedAtIsNull(replyId)).thenReturn(List.of());

        commentService.delete(authorId, commentId);

        assertThat(comment.isDeleted()).isTrue();
        assertThat(reply.isDeleted()).isTrue();
    }
}
