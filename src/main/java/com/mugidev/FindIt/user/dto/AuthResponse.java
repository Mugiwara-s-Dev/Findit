package com.mugidev.FindIt.user.dto;

public record AuthResponse(
        String token,
        UserResponse user
) {
}
