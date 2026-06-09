// Convierte excepciones comunes en respuestas HTTP consistentes.
package com.mugidev.FindIt.shared.api;

import jakarta.persistence.EntityExistsException;
import jakarta.persistence.EntityNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.util.stream.Collectors;

@RestControllerAdvice
public class ApiErrorHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException exception, HttpServletRequest request) {
        ProblemDetail detail = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        detail.setTitle("Validation error");
        detail.setType(URI.create("https://findit.api/errors/validation"));
        detail.setDetail(exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining(", ")));
        detail.setProperty("path", request.getRequestURI());
        return detail;
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ProblemDetail handleConstraintViolation(ConstraintViolationException exception, HttpServletRequest request) {
        ProblemDetail detail = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        detail.setTitle("Constraint violation");
        detail.setType(URI.create("https://findit.api/errors/constraint-violation"));
        detail.setDetail(exception.getMessage());
        detail.setProperty("path", request.getRequestURI());
        return detail;
    }

    @ExceptionHandler(EntityNotFoundException.class)
    public ProblemDetail handleNotFound(EntityNotFoundException exception, HttpServletRequest request) {
        ProblemDetail detail = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        detail.setTitle("Resource not found");
        detail.setType(URI.create("https://findit.api/errors/not-found"));
        detail.setDetail(exception.getMessage());
        detail.setProperty("path", request.getRequestURI());
        return detail;
    }

    @ExceptionHandler(EntityExistsException.class)
    public ProblemDetail handleAlreadyExists(EntityExistsException exception, HttpServletRequest request) {
        ProblemDetail detail = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        detail.setTitle("Resource already exists");
        detail.setType(URI.create("https://findit.api/errors/conflict"));
        detail.setDetail(exception.getMessage());
        detail.setProperty("path", request.getRequestURI());
        return detail;
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ProblemDetail handleBadCredentials(BadCredentialsException exception, HttpServletRequest request) {
        ProblemDetail detail = ProblemDetail.forStatus(HttpStatus.UNAUTHORIZED);
        detail.setTitle("Authentication failed");
        detail.setType(URI.create("https://findit.api/errors/authentication"));
        detail.setDetail(exception.getMessage());
        detail.setProperty("path", request.getRequestURI());
        return detail;
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleAccessDenied(AccessDeniedException exception, HttpServletRequest request) {
        ProblemDetail detail = ProblemDetail.forStatus(HttpStatus.FORBIDDEN);
        detail.setTitle("Access denied");
        detail.setType(URI.create("https://findit.api/errors/access-denied"));
        detail.setDetail(exception.getMessage());
        detail.setProperty("path", request.getRequestURI());
        return detail;
    }
}
