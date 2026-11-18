package com.nexuscloud.api.service;

import com.nexuscloud.api.model.UserAccount;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;

@Service
public class UserService {

    private final PasswordEncoder encoder;

    private final Map<String, UserAccount> users =
            new HashMap<>();

    private final Path userFile;

    public UserService(

            PasswordEncoder encoder,

            @Value("${NEXUS_ADMIN_EMAIL}")
            String adminEmail,

            @Value("${NEXUS_ADMIN_PASSWORD}")
            String adminPassword,

            @Value("${NEXUS_USER_FILE:data/security/users.properties}")
            String location

    ) throws IOException {

        this.encoder = encoder;

        this.userFile = Path.of(location)
                .toAbsolutePath();

        Files.createDirectories(
                userFile.getParent()
        );

        load();

        String email = normalizeEmail(adminEmail);

        validateEmail(email);

        UserAccount existing = users.get(email);

        if (existing == null) {

            validatePassword(adminPassword);

            createAccount(
                    email,
                    adminPassword,
                    "ADMIN"
            );

            System.out.println(
                    "[SECURITY] Administrator initialized"
            );

        } else if (!"ADMIN".equals(existing.role())) {

            throw new IllegalStateException(
                    "Administrator email already belongs to a user"
            );
        }
    }

    private String normalizeEmail(String email) {

        if (email == null) {
            return "";
        }

        return email.trim()
                .toLowerCase(Locale.ROOT);
    }

    private void validateEmail(String email) {

        if (email.length() > 254
                || !email.matches(
                "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid email"
            );
        }
    }

    private void validatePassword(String password) {

        if (password == null
                || password.length() < 12
                || password.getBytes(
                    StandardCharsets.UTF_8
                ).length > 72) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Password must contain at least 12 characters and at most 72 UTF-8 bytes"
            );
        }
    }

    private void load() throws IOException {

        if (!Files.exists(userFile)) {
            return;
        }

        Properties properties = new Properties();

        try (InputStream input =
                     Files.newInputStream(userFile)) {

            properties.load(input);
        }

        for (String key :
                properties.stringPropertyNames()) {

            if (!key.endsWith(".email")) {
                continue;
            }

            String id = key.substring(
                    0,
                    key.length() - 6
            );

            String email =
                    properties.getProperty(id + ".email");

            String hash =
                    properties.getProperty(id + ".password");

            String role =
                    properties.getProperty(id + ".role");

            if (hash == null
                    || role == null
                    || (!role.equals("USER")
                    && !role.equals("ADMIN"))) {

                throw new IOException(
                        "Invalid account metadata"
                );
            }

            users.put(
                    email,
                    new UserAccount(
                            id,
                            email,
                            hash,
                            role
                    )
            );
        }

        System.out.println(
                "[SECURITY] Restored "
                + users.size()
                + " account(s)"
        );
    }

    private void save(
            Map<String, UserAccount> accounts
    ) throws IOException {

        Properties properties = new Properties();

        for (UserAccount user : accounts.values()) {

            String id = user.id();

            properties.setProperty(
                    id + ".email",
                    user.email()
            );

            properties.setProperty(
                    id + ".password",
                    user.passwordHash()
            );

            properties.setProperty(
                    id + ".role",
                    user.role()
            );
        }

        Path temporary = Files.createTempFile(
                userFile.getParent(),
                "users-",
                ".tmp"
        );

        try {

            try (FileOutputStream output =
                         new FileOutputStream(
                                 temporary.toFile())) {

                properties.store(
                        output,
                        "NEXUS Cloud users"
                );

                output.flush();

                output.getFD().sync();
            }

            Files.move(
                    temporary,
                    userFile,
                    StandardCopyOption.REPLACE_EXISTING,
                    StandardCopyOption.ATOMIC_MOVE
            );

        } finally {

            Files.deleteIfExists(temporary);
        }
    }

    private UserAccount createAccount(
            String email,
            String password,
            String role
    ) throws IOException {

        UserAccount account =
                new UserAccount(
                        UUID.randomUUID().toString(),
                        email,
                        encoder.encode(password),
                        role
                );

        Map<String, UserAccount> updated =
                new HashMap<>(users);

        updated.put(email, account);

        save(updated);

        users.put(email, account);

        return account;
    }

    public synchronized UserAccount register(
            String email,
            String password
    ) throws IOException {

        email = normalizeEmail(email);

        validateEmail(email);

        validatePassword(password);

        if (users.containsKey(email)) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Account already exists"
            );
        }

        return createAccount(
                email,
                password,
                "USER"
        );
    }

    public synchronized UserAccount authenticate(
            String email,
            String password
    ) {

        email = normalizeEmail(email);

        UserAccount user = users.get(email);

        if (user == null
                || password == null
                || password.getBytes(
                    StandardCharsets.UTF_8
                ).length > 72
                || !encoder.matches(
                        password,
                        user.passwordHash())) {

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Invalid credentials"
            );
        }

        return user;
    }

    public synchronized UserAccount findById(
            String id
    ) {

        return users.values()
                .stream()
                .filter(user -> user.id().equals(id))
                .findFirst()
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.UNAUTHORIZED,
                                "Account not found"
                        )
                );
    }
}