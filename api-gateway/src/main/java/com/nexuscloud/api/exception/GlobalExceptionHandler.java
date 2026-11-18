package com.nexuscloud.api.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.http.converter.HttpMessageNotReadableException;

import java.rmi.RemoteException;
import java.rmi.NotBoundException;
import java.rmi.ConnectException;
import java.time.Instant;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private ResponseEntity<Map<String, Object>> error(
            HttpStatus status,
            String message
    ) {

        return ResponseEntity
                .status(status)
                .body(Map.of(
                        "timestamp", Instant.now().toString(),
                        "status", status.value(),
                        "error", status.getReasonPhrase(),
                        "message", message
                ));
    }

    @ExceptionHandler({
            IllegalArgumentException.class,
            MissingServletRequestParameterException.class,
            MissingServletRequestPartException.class,
            HttpMessageNotReadableException.class
    })
    public ResponseEntity<Map<String, Object>> badRequest(
            Exception exception
    ) {

        return error(
                HttpStatus.BAD_REQUEST,
                "Invalid request or file parameters"
        );
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> uploadSize(
            MaxUploadSizeExceededException exception
    ) {

        return error(
                HttpStatus.PAYLOAD_TOO_LARGE,
                "Maximum file size is 100 MB"
        );
    }

    @ExceptionHandler({
            ConnectException.class,
            NotBoundException.class
    })
    public ResponseEntity<Map<String, Object>> unavailable(
            Exception exception
    ) {

        return error(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Distributed storage service unavailable"
        );
    }

    @ExceptionHandler(RemoteException.class)
    public ResponseEntity<Map<String, Object>> remoteError(
            RemoteException exception
    ) {

        String message =
                String.valueOf(exception.getMessage());

        if (message.contains("File not found")
                || message.contains("Directory not found")) {

            return error(
                    HttpStatus.NOT_FOUND,
                    "Requested resource not found"
            );
        }

        if (message.contains("Directory is not empty")
                || message.contains("Directory contains subdirectories")
                || message.contains("already exists")
                || message.contains("cannot be reused")) {

            return error(
                    HttpStatus.CONFLICT,
                    "Operation conflicts with current storage state"
            );
        }

        if (message.contains("Invalid")
                || message.contains("Root directory cannot be deleted")) {

            return error(
                    HttpStatus.BAD_REQUEST,
                    "Invalid storage operation"
            );
        }

        return error(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Distributed storage operation failed"
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> unexpected(
            Exception exception
    ) {

        exception.printStackTrace();

        return error(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Unexpected server error"
        );
    }
}