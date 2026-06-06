package com.mugidev.FindIt.shared.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mugidev.FindIt.user.dto.AuthResponse;
import com.mugidev.FindIt.user.service.GoogleOAuthService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Component
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {

    private final GoogleOAuthService googleOAuthService;
    private final ObjectMapper objectMapper;
    private final String frontendCallbackUrl;

    public OAuth2LoginSuccessHandler(GoogleOAuthService googleOAuthService,
                                     ObjectMapper objectMapper,
                                     @Value("${findit.auth.frontend-callback-url}") String frontendCallbackUrl) {
        this.googleOAuthService = googleOAuthService;
        this.objectMapper = objectMapper;
        this.frontendCallbackUrl = frontendCallbackUrl;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        OidcUser oidcUser = (OidcUser) authentication.getPrincipal();
        AuthResponse authResponse = googleOAuthService.loginWithGoogle(oidcUser);

        String encodedUser = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(objectMapper.writeValueAsBytes(authResponse.user()));

        String redirectUrl = frontendCallbackUrl
                + "#token=" + URLEncoder.encode(authResponse.token(), StandardCharsets.UTF_8)
                + "&user=" + URLEncoder.encode(encodedUser, StandardCharsets.UTF_8);

        response.sendRedirect(redirectUrl);
    }
}
