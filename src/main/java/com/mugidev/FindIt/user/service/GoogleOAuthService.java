package com.mugidev.FindIt.user.service;

import com.mugidev.FindIt.shared.security.PasswordHasher;
import com.mugidev.FindIt.user.domain.UserAccount;
import com.mugidev.FindIt.user.domain.UserRole;
import com.mugidev.FindIt.user.dto.AuthResponse;
import com.mugidev.FindIt.user.repository.UserAccountRepository;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class GoogleOAuthService {

    private static final double DEFAULT_LATITUDE = 1.23207;
    private static final double DEFAULT_LONGITUDE = -77.29295;

    private final UserAccountRepository userAccountRepository;
    private final PasswordHasher passwordHasher;
    private final AuthService authService;

    public GoogleOAuthService(UserAccountRepository userAccountRepository,
                              PasswordHasher passwordHasher,
                              AuthService authService) {
        this.userAccountRepository = userAccountRepository;
        this.passwordHasher = passwordHasher;
        this.authService = authService;
    }

    @Transactional
    public AuthResponse loginWithGoogle(OidcUser oidcUser) {
        String googleSubject = oidcUser.getSubject();
        String email = oidcUser.getEmail();
        String fullName = resolveFullName(oidcUser);

        if (!Boolean.TRUE.equals(oidcUser.getEmailVerified())) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("google_email_not_verified"),
                    "La cuenta de Google no tiene un correo verificado"
            );
        }

        UserAccount user = userAccountRepository.findByGoogleSubject(googleSubject)
                .map(existing -> refreshExistingUser(existing, fullName, email))
                .orElseGet(() -> userAccountRepository.findByEmailIgnoreCase(email)
                        .map(existing -> linkExistingEmailUser(existing, googleSubject, fullName, email))
                        .orElseGet(() -> createGoogleUser(googleSubject, fullName, email)));

        return authService.createSession(user);
    }

    private UserAccount refreshExistingUser(UserAccount user, String fullName, String email) {
        user.refreshProfile(fullName, email);
        return userAccountRepository.save(user);
    }

    private UserAccount linkExistingEmailUser(UserAccount user,
                                              String googleSubject,
                                              String fullName,
                                              String email) {
        if (user.getGoogleSubject() != null && !user.getGoogleSubject().equals(googleSubject)) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("google_account_conflict"),
                    "Ya existe una cuenta enlazada con ese correo"
            );
        }

        user.linkGoogleAccount(googleSubject);
        user.refreshProfile(fullName, email);
        return userAccountRepository.save(user);
    }

    private UserAccount createGoogleUser(String googleSubject, String fullName, String email) {
        UserAccount user = new UserAccount(
                fullName,
                email,
                passwordHasher.hash(UUID.randomUUID().toString()),
                UserRole.CUSTOMER,
                DEFAULT_LATITUDE,
                DEFAULT_LONGITUDE
        );
        user.linkGoogleAccount(googleSubject);
        return userAccountRepository.save(user);
    }

    private String resolveFullName(OidcUser oidcUser) {
        if (oidcUser.getFullName() != null && !oidcUser.getFullName().isBlank()) {
            return oidcUser.getFullName();
        }

        if (oidcUser.getGivenName() != null && !oidcUser.getGivenName().isBlank()) {
            return oidcUser.getGivenName();
        }

        return oidcUser.getEmail();
    }
}
