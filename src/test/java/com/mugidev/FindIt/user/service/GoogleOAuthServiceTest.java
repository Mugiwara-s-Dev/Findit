package com.mugidev.FindIt.user.service;

import com.mugidev.FindIt.user.dto.AuthResponse;
import com.mugidev.FindIt.user.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@SpringBootTest
@Transactional
class GoogleOAuthServiceTest {

    @Autowired
    private GoogleOAuthService googleOAuthService;

    @Autowired
    private UserAccountRepository userAccountRepository;

    @Test
    void shouldCreateLocalAccountFromGoogleLogin() {
        OidcUser oidcUser = mockGoogleUser(
                "google-sub-100",
                "nuevo-google@example.com",
                "Nuevo Usuario Google",
                true
        );

        AuthResponse response = googleOAuthService.loginWithGoogle(oidcUser);

        var savedUser = userAccountRepository.findByEmailIgnoreCase("nuevo-google@example.com").orElseThrow();
        assertThat(response.user().email()).isEqualTo("nuevo-google@example.com");
        assertThat(savedUser.getGoogleSubject()).isEqualTo("google-sub-100");
    }

    @Test
    void shouldLinkExistingEmailAccountOnGoogleLogin() {
        OidcUser oidcUser = mockGoogleUser(
                "google-sub-laura",
                "laura@findit.local",
                "Laura Google",
                true
        );

        googleOAuthService.loginWithGoogle(oidcUser);

        var linkedUser = userAccountRepository.findByEmailIgnoreCase("laura@findit.local").orElseThrow();
        assertThat(linkedUser.getGoogleSubject()).isEqualTo("google-sub-laura");
        assertThat(linkedUser.getFullName()).isEqualTo("Laura Google");
    }

    private OidcUser mockGoogleUser(String subject, String email, String fullName, boolean emailVerified) {
        OidcUser oidcUser = mock(OidcUser.class);
        when(oidcUser.getSubject()).thenReturn(subject);
        when(oidcUser.getEmail()).thenReturn(email);
        when(oidcUser.getFullName()).thenReturn(fullName);
        when(oidcUser.getGivenName()).thenReturn(fullName);
        when(oidcUser.getEmailVerified()).thenReturn(emailVerified);
        return oidcUser;
    }
}
