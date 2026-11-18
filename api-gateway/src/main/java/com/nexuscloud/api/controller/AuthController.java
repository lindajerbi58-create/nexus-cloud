package com.nexuscloud.api.controller;

import com.nexuscloud.api.model.UserAccount;
import com.nexuscloud.api.security.JwtService;
import com.nexuscloud.api.service.UserService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService users;

    private final JwtService jwtService;

    public AuthController(
            UserService users,
            JwtService jwtService
    ) {

        this.users = users;
        this.jwtService = jwtService;
    }

    public record AuthRequest(

            String email,

            String password

    ) {}

    private Map<String, Object> profile(
            UserAccount user
    ) {

        return Map.of(
                "id", user.id(),
                "email", user.email(),
                "role", user.role()
        );
    }

    private Map<String, Object> tokenResponse(
            UserAccount user
    ) {

        return Map.of(
                "token",
                jwtService.generateToken(user),

                "tokenType",
                "Bearer",

                "expiresIn",
                jwtService.getExpirationSeconds(),

                "user",
                profile(user)
        );
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(
            @RequestBody AuthRequest request
    ) throws Exception {

        UserAccount user = users.register(
                request.email(),
                request.password()
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(tokenResponse(user));
    }

    @PostMapping("/login")
    public Map<String, Object> login(
            @RequestBody AuthRequest request
    ) {

        UserAccount user = users.authenticate(
                request.email(),
                request.password()
        );

        return tokenResponse(user);
    }

    @GetMapping("/me")
    public Map<String, Object> me(
            @AuthenticationPrincipal Jwt jwt
    ) {

        UserAccount user =
                users.findById(jwt.getSubject());

        return profile(user);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> authError(
            ResponseStatusException exception
    ) {

        return ResponseEntity
                .status(exception.getStatusCode())
                .body(Map.of(
                        "status",
                        exception.getStatusCode().value(),

                        "message",
                        exception.getReason() == null
                                ? "Authentication error"
                                : exception.getReason()
                ));
    }
}