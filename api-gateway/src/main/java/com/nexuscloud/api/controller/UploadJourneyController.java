package com.nexuscloud.api.controller;

import com.nexuscloud.api.service.UploadJourneyService;
import com.nexuscloud.api.service.UploadJourneyService.JourneySnapshot;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/files/journey")
public class UploadJourneyController {

    private final UploadJourneyService journeys;

    public UploadJourneyController(
            UploadJourneyService journeys
    ) {

        this.journeys = journeys;
    }

    @PostMapping
    public ResponseEntity<JourneySnapshot> create(

            @AuthenticationPrincipal Jwt jwt

    ) {

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(journeys.create(jwt));
    }

    @GetMapping("/{id}")
    public JourneySnapshot status(

            @AuthenticationPrincipal Jwt jwt,

            @PathVariable String id

    ) {

        return journeys.get(jwt, id);
    }

    @PostMapping(
            value = "/{id}/upload",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<JourneySnapshot> upload(

            @AuthenticationPrincipal Jwt jwt,

            @PathVariable String id,

            @RequestParam("file")
            MultipartFile file,

            @RequestParam(
                    value = "directory",
                    defaultValue = "/"
            )
            String directory

    ) throws Exception {

        JourneySnapshot result =
                journeys.upload(
                        jwt,
                        id,
                        file,
                        directory
                );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(result);
    }
}