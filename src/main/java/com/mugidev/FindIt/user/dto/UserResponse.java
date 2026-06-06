package com.mugidev.FindIt.user.dto;

import com.mugidev.FindIt.user.domain.UserRole;

import java.time.LocalDateTime;

public record UserResponse(
        Long id,
        String fullName,
        String email,
        UserRole role,
        Double preferredLatitude,
        Double preferredLongitude,
        LocalDateTime createdAt
) {
}
