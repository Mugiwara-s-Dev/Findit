// Servicio para generar y validar tokens JWT para autenticación de usuarios.
// Genera y valida tokens JWT para la sesion de usuario.
package com.mugidev.FindIt.shared.security;

import com.mugidev.FindIt.user.domain.UserAccount;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.DecodingException;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

@Service
public class JwtService {

    private final SecretKey signingKey;
    private final long expirationMinutes;

    public JwtService(@Value("${findit.auth.jwt-secret}") String secret,
                      @Value("${findit.auth.jwt-expiration-minutes}") long expirationMinutes) {
        this.signingKey = resolveKey(secret);
        this.expirationMinutes = expirationMinutes;
    }

    public String generateToken(UserAccount user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.getEmail())
                .claim("userId", user.getId())
                .claim("role", user.getRole().name())
                .claim("fullName", user.getFullName())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(expirationMinutes, ChronoUnit.MINUTES)))
                .signWith(signingKey)
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey resolveKey(String secret) {
        try {
            return Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
        } catch (IllegalArgumentException | DecodingException ignored) {
            return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        }
    }
}
