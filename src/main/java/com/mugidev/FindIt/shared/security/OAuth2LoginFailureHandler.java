package com.mugidev.FindIt.shared.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
public class OAuth2LoginFailureHandler implements AuthenticationFailureHandler {

    private final String frontendCallbackUrl;

    public OAuth2LoginFailureHandler(@Value("${findit.auth.frontend-callback-url}") String frontendCallbackUrl) {
        this.frontendCallbackUrl = frontendCallbackUrl;
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request,
                                        HttpServletResponse response,
                                        AuthenticationException exception) throws IOException, ServletException {
        String message = exception.getMessage() == null || exception.getMessage().isBlank()
                ? "No fue posible iniciar sesión con Google"
                : exception.getMessage();

        response.sendRedirect(
                frontendCallbackUrl + "#error=" + URLEncoder.encode(message, StandardCharsets.UTF_8)
        );
    }
}
