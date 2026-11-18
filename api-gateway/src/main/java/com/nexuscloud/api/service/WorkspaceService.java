package com.nexuscloud.api.service;

import com.nexuscloud.common.model.FileMetadata;

import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class WorkspaceService {

    private static final String USER_ROOT =
            "/.nexus-users";

    private final NexusService nexus;

    private final UserService users;

    public WorkspaceService(
            NexusService nexus,
            UserService users
    ) {
        this.nexus = nexus;
        this.users = users;
    }

    private boolean isAdmin(Jwt jwt) {

        return "ADMIN".equals(
                users.findById(
                        jwt.getSubject()
                ).role()
        );
    }

    private String workspaceRoot(Jwt jwt)
            throws Exception {

        String userId = users.findById(
                jwt.getSubject()
        ).id();

        if (!userId.matches(
                "[a-zA-Z0-9_-]{1,128}")) {

            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Invalid user identifier"
            );
        }

        String root = USER_ROOT + "/" + userId;

        nexus.createDirectory(USER_ROOT);

        nexus.createDirectory(root);

        return root;
    }

    private String normalize(String path) {

        if (path == null || path.isBlank()) {
            return "/";
        }

        path = path.trim();

        if (path.contains("\\")) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid directory path"
            );
        }

        if (!path.startsWith("/")) {
            path = "/" + path;
        }

        path = path.replaceAll("/+", "/");

        while (path.length() > 1
                && path.endsWith("/")) {

            path = path.substring(
                    0,
                    path.length() - 1
            );
        }

        if (path.equals("/")) {
            return "/";
        }

        if (path.length() > 900) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Directory path too long"
            );
        }

        for (String part :
                path.substring(1).split("/")) {

            if (part.equals(".")
                    || part.equals("..")
                    || !part.matches(
                        "[\\p{L}\\p{N}_ .-]{1,100}")) {

                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Invalid directory name"
                );
            }
        }

        return path;
    }

    private String resolvePath(
            Jwt jwt,
            String path
    ) throws Exception {

        String normalized = normalize(path);

        if (isAdmin(jwt)) {
            return normalized;
        }

        String root = workspaceRoot(jwt);

        return normalized.equals("/")
                ? root
                : root + normalized;
    }

    private String visiblePath(
            Jwt jwt,
            String physicalPath
    ) throws Exception {

        if (isAdmin(jwt)) {
            return physicalPath;
        }

        String root = workspaceRoot(jwt);

        if (physicalPath.equals(root)) {
            return "/";
        }

        if (!physicalPath.startsWith(root + "/")) {

            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Access denied"
            );
        }

        return physicalPath.substring(
                root.length()
        );
    }

    private boolean belongsTo(
            String path,
            String root
    ) {

        return path.equals(root)
                || path.startsWith(root + "/");
    }

    private void requireFileAccess(
            Jwt jwt,
            String fileId
    ) throws Exception {

        if (isAdmin(jwt)) {
            return;
        }

        String root = workspaceRoot(jwt);

        String actualDirectory =
                nexus.directory()
                        .getFileDirectory(fileId);

        if (!belongsTo(
                actualDirectory,
                root)) {

            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Access to this file is denied"
            );
        }
    }

    public synchronized List<FileMetadata> listFiles(
            Jwt jwt
    ) throws Exception {

        if (isAdmin(jwt)) {
            return nexus.listFiles();
        }

        String root = workspaceRoot(jwt);

        List<FileMetadata> result =
                new ArrayList<>();

        for (FileMetadata file :
                nexus.listFiles()) {

            try {

                String location =
                        nexus.directory()
                                .getFileDirectory(
                                        file.fileId()
                                );

                if (belongsTo(location, root)) {
                    result.add(file);
                }

            } catch (java.rmi.RemoteException e) {

                if (!String.valueOf(e.getMessage())
                        .contains("File not found")) {

                    throw e;
                }
            }
        }

        return result;
    }

    public synchronized FileMetadata getFile(
            Jwt jwt,
            String fileId
    ) throws Exception {

        requireFileAccess(jwt, fileId);

        return nexus.getFile(fileId);
    }

    public synchronized FileMetadata upload(
            Jwt jwt,
            MultipartFile file,
            String directory
    ) throws Exception {

        String target = resolvePath(
                jwt,
                directory
        );

        return nexus.upload(file, target);
    }

    public record DownloadResult(
            FileMetadata metadata,
            byte[] content
    ) {}

    public synchronized DownloadResult download(
            Jwt jwt,
            String fileId
    ) throws Exception {

        requireFileAccess(jwt, fileId);

        FileMetadata metadata =
                nexus.getFile(fileId);

        byte[] content =
                nexus.download(fileId);

        return new DownloadResult(
                metadata,
                content
        );
    }

    public synchronized void deleteFile(
            Jwt jwt,
            String fileId
    ) throws Exception {

        requireFileAccess(jwt, fileId);

        nexus.deleteFile(fileId);
    }

    public synchronized void moveFile(
            Jwt jwt,
            String fileId,
            String directory
    ) throws Exception {

        requireFileAccess(jwt, fileId);

        String target = resolvePath(
                jwt,
                directory
        );

        nexus.moveFile(fileId, target);
    }

    public synchronized List<String> listDirectories(
            Jwt jwt
    ) throws Exception {

        if (isAdmin(jwt)) {
            return nexus.listDirectories();
        }

        String root = workspaceRoot(jwt);

        List<String> result =
                new ArrayList<>();

        for (String directory :
                nexus.listDirectories()) {

            if (belongsTo(directory, root)) {

                result.add(
                        visiblePath(jwt, directory)
                );
            }
        }

        return result;
    }

    public synchronized Map<String, Object> contents(
            Jwt jwt,
            String path
    ) throws Exception {

        String actualPath = resolvePath(jwt, path);

        var directoryService = nexus.directory();

        List<String> directories =
                new ArrayList<>();

        for (String child :
                directoryService.listSubdirectories(
                        actualPath)) {

            directories.add(
                    visiblePath(jwt, child)
            );
        }

        return Map.of(
                "path",
                visiblePath(jwt, actualPath),

                "directories",
                directories,

                "files",
                directoryService.listFiles(actualPath)
        );
    }

    public synchronized void createDirectory(
            Jwt jwt,
            String path
    ) throws Exception {

        nexus.createDirectory(
                resolvePath(jwt, path)
        );
    }

    public synchronized void deleteDirectory(
            Jwt jwt,
            String path
    ) throws Exception {

        String actualPath =
                resolvePath(jwt, path);

        if (actualPath.equals("/")
                || actualPath.equals(USER_ROOT)
                || (!isAdmin(jwt)
                    && actualPath.equals(
                        workspaceRoot(jwt)))) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Workspace root cannot be deleted"
            );
        }

        nexus.deleteDirectory(actualPath);
    }
}