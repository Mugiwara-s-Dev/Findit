package com.mugidev.FindIt.user.service;

import com.mugidev.FindIt.shared.security.JwtService;
import com.mugidev.FindIt.shared.security.PasswordHasher;
import com.mugidev.FindIt.user.domain.UserAccount;
import com.mugidev.FindIt.user.dto.AuthResponse;
import com.mugidev.FindIt.user.dto.LoginRequest;
import com.mugidev.FindIt.user.dto.UserResponse;
import com.mugidev.FindIt.user.repository.UserAccountRepository;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AuthService {

    private final UserAccountRepository userAccountRepository;
    private final PasswordHasher passwordHasher;
    private final JwtService jwtService;

    public AuthService(UserAccountRepository userAccountRepository,
                       PasswordHasher passwordHasher,
                       JwtService jwtService) {
        this.userAccountRepository = userAccountRepository;
        this.passwordHasher = passwordHasher;
        this.jwtService = jwtService;
    }

    public AuthResponse login(LoginRequest request) {
        var user = userAccountRepository.findByEmailIgnoreCase(request.email())
                .orElseThrow(() -> new BadCredentialsException("Credenciales inválidas"));

        if (!passwordHasher.matches(request.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Credenciales inválidas");
        }

        return createSession(user);
    }

    public AuthResponse createSession(UserAccount user) {
        UserResponse response = new UserResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole(),
                user.getPreferredLatitude(),
                user.getPreferredLongitude(),
                user.getCreatedAt()
        );

        return new AuthResponse(jwtService.generateToken(user), response);
    }
}
