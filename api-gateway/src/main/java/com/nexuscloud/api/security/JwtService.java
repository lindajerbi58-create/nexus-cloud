package com.nexuscloud.api.security;

import com.nexuscloud.api.model.UserAccount;

import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class JwtService {

    private final JwtEncoder encoder;

    private static final long EXPIRATION_SECONDS =
            3600;

    public JwtService(JwtEncoder encoder) {

        this.encoder = encoder;
    }

    public String generateToken(
            UserAccount user
    ) {

        Instant now = Instant.now();

        JwtClaimsSet claims =
                JwtClaimsSet.builder()

                        .issuer("nexus-cloud")

                        .issuedAt(now)

                        .expiresAt(
                                now.plusSeconds(
                                        EXPIRATION_SECONDS
                                )
                        )

                        .subject(user.id())

                        .claim(
                                "email",
                                user.email()
                        )

                        .claim(
                                "roles",
                                List.of(user.role())
                        )

                        .build();

        JwsHeader header =
                JwsHeader.with(
                        MacAlgorithm.HS256
                ).build();

        return encoder.encode(
                JwtEncoderParameters.from(
                        header,
                        claims
                )
        ).getTokenValue();
    }

    public long getExpirationSeconds() {

        return EXPIRATION_SECONDS;
    }
}