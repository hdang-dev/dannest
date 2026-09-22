package com.dannest.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.dannest.common.BadRequestException;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.user.dto.UpdateUserRequest;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    private User userWithId(UUID id) {
        User user = User.forProvider("dan", "dan@example.com", "GOOGLE", "sub-1", null);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    @Test
    void throwsWhenTheUserDoesNotExist() {
        UUID id = UUID.randomUUID();
        when(userRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.get(id, id)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void hidesTheEmailFromSomeoneWhoIsNotTheOwner() {
        UUID ownerId = UUID.randomUUID();
        when(userRepository.findById(ownerId)).thenReturn(Optional.of(userWithId(ownerId)));

        var response = userService.get(UUID.randomUUID(), ownerId);

        assertThat(response.email()).isNull();
    }

    @Test
    void showsTheEmailToTheOwnerThemselves() {
        UUID ownerId = UUID.randomUUID();
        when(userRepository.findById(ownerId)).thenReturn(Optional.of(userWithId(ownerId)));

        var response = userService.get(ownerId, ownerId);

        assertThat(response.email()).isEqualTo("dan@example.com");
    }

    @Test
    void rejectsAUsernameThatIsAlreadyTaken() {
        UUID id = UUID.randomUUID();
        User user = userWithId(id);
        when(userRepository.findById(id)).thenReturn(Optional.of(user));
        when(userRepository.existsByUsernameAndIdNot("taken", id)).thenReturn(true);

        assertThatThrownBy(() -> userService.updateMe(id, new UpdateUserRequest("taken", null, null, null, null, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void requiresAnAvatarUrlWhenSettingAnAvatarMediaId() {
        UUID id = UUID.randomUUID();
        when(userRepository.findById(id)).thenReturn(Optional.of(userWithId(id)));

        assertThatThrownBy(() -> userService.updateMe(
                id, new UpdateUserRequest(null, null, "media-1", null, null, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void clearingTheAvatarRemovesItRegardlessOfOtherFields() {
        UUID id = UUID.randomUUID();
        User user = userWithId(id);
        user.setAvatarMediaId("media-1");
        user.setAvatarMediaUrl("https://old");
        when(userRepository.findById(id)).thenReturn(Optional.of(user));

        userService.updateMe(id, new UpdateUserRequest(null, null, null, null, null, true));

        assertThat(user.getAvatarMediaId()).isNull();
        assertThat(user.getAvatarMediaUrl()).isNull();
    }

    @Test
    void updatesBioAndUsernameWhenValid() {
        UUID id = UUID.randomUUID();
        User user = userWithId(id);
        when(userRepository.findById(id)).thenReturn(Optional.of(user));
        when(userRepository.existsByUsernameAndIdNot("newname", id)).thenReturn(false);

        var response = userService.updateMe(id, new UpdateUserRequest("newname", "new bio", null, null, null, null));

        assertThat(response.username()).isEqualTo("newname");
        assertThat(user.getBio()).isEqualTo("new bio");
    }
}
