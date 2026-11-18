package com.nexuscloud.api.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

public record UserAccount(

        String id,

        String email,

        @JsonIgnore
        String passwordHash,

        String role

) {}