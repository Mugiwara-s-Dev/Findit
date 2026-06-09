// Gestiona la logica de negocio de las cuentas de usuario.
package com.mugidev.FindIt.user.service;

import com.mugidev.FindIt.user.domain.UserAccount;
import com.mugidev.FindIt.user.domain.UserRole;
import com.mugidev.FindIt.user.dto.CreateUserRequest;
import com.mugidev.FindIt.user.dto.UserResponse;
import com.mugidev.FindIt.user.repository.UserAccountRepository;
import com.mugidev.FindIt.shared.security.PasswordHasher;
import jakarta.persistence.EntityExistsException;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class UserService {

    private final UserAccountRepository userAccountRepository;
    private final PasswordHasher passwordHasher;

    public UserService(UserAccountRepository userAccountRepository, PasswordHasher passwordHasher) {
        this.userAccountRepository = userAccountRepository;
        this.passwordHasher = passwordHasher;
    }

    public List<UserResponse> listUsers() {
        return userAccountRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    public UserResponse getUser(Long userId) {
        return userAccountRepository.findById(userId)
                .map(this::toResponse)
                .orElseThrow(() -> new EntityNotFoundException("No hemos encontrado un usuario con id " + userId));
    }

    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        userAccountRepository.findByEmailIgnoreCase(request.email())
                .ifPresent(existing -> {
                    throw new EntityExistsException("Un usuario con email " + request.email() + " ya existe");
                });

        UserAccount user = new UserAccount(
                request.fullName(),
                request.email(),
                passwordHasher.hash(request.password()),
                UserRole.CUSTOMER,
                request.preferredLatitude(),
                request.preferredLongitude()
        );

        return toResponse(userAccountRepository.save(user));
    }

    private UserResponse toResponse(UserAccount user) {
        return new UserResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole(),
                user.getPreferredLatitude(),
                user.getPreferredLongitude(),
                user.getCreatedAt()
        );
    }
}
