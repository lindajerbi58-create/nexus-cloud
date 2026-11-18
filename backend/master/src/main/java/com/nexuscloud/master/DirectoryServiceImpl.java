package com.nexuscloud.master;

import com.nexuscloud.common.model.FileMetadata;
import com.nexuscloud.common.rmi.DirectoryService;
import com.nexuscloud.common.rmi.MasterService;

import java.io.IOException;
import java.io.InputStream;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.rmi.RemoteException;
import java.rmi.server.UnicastRemoteObject;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Properties;
import java.util.Comparator;

public class DirectoryServiceImpl
        extends UnicastRemoteObject
        implements DirectoryService {

    private final MasterService master;

    private final Path directoryFile;

    private final Set<String> directories =
            new HashSet<>();

    private final Map<String, String> fileLocations =
            new HashMap<>();

    public DirectoryServiceImpl(MasterService master)
            throws RemoteException {

        super();

        this.master = master;

        this.directoryFile = Path.of(
                "data",
                "master",
                "directories.properties"
        ).toAbsolutePath();

        directories.add("/");

        try {

            Files.createDirectories(
                    directoryFile.getParent()
            );

            load();

        } catch (IOException e) {

            UnicastRemoteObject.unexportObject(
                    this, true
            );

            throw new RemoteException(
                    "Unable to load directories", e
            );
        }

        System.out.println(
                "[DIRECTORY] Directory service initialized"
        );
    }

    private String normalize(String path)
            throws RemoteException {

        if (path == null || path.isBlank()) {

            throw new RemoteException(
                    "Invalid directory path"
            );
        }

        path = path.trim().replace('\\', '/');

        if (!path.startsWith("/")) {
            path = "/" + path;
        }

        path = path.replaceAll("/+", "/");

        while (path.length() > 1
                && path.endsWith("/")) {

            path = path.substring(
                    0, path.length() - 1
            );
        }

        if (path.equals("/")) {
            return path;
        }

        if (path.length() > 1024) {

            throw new RemoteException(
                    "Directory path is too long"
            );
        }

        for (String part : path.substring(1).split("/")) {

            if (part.equals(".")
                    || part.equals("..")
                    || !part.matches(
                        "[\\p{L}\\p{N}_ .-]{1,100}")) {

                throw new RemoteException(
                        "Invalid directory name: " + part
                );
            }
        }

        return path;
    }

    private String parentOf(String path) {

        int index = path.lastIndexOf('/');

        if (index <= 0) {
            return "/";
        }

        return path.substring(0, index);
    }

    private void requireDirectory(String path)
            throws RemoteException {

        if (!directories.contains(path)) {

            throw new RemoteException(
                    "Directory not found: " + path
            );
        }
    }

    private void load() throws IOException {

        if (!Files.exists(directoryFile)) {

            System.out.println(
                    "[DIRECTORY] Empty directory registry"
            );

            return;
        }

        Properties properties = new Properties();

        try (InputStream input =
                     Files.newInputStream(directoryFile)) {

            properties.load(input);
        }

        for (String key :
                properties.stringPropertyNames()) {

            if (key.startsWith("dir.")) {

                directories.add(
                        key.substring(4)
                );

            } else if (key.startsWith("file.")) {

                fileLocations.put(
                        key.substring(5),
                        properties.getProperty(key)
                );
            }
        }

        directories.add("/");

        System.out.println(
                "[DIRECTORY] Restored "
                + directories.size()
                + " directories"
        );
    }

    private void save(
            Set<String> updatedDirectories,
            Map<String, String> updatedLocations
    ) throws RemoteException {

        Properties properties = new Properties();

        for (String directory : updatedDirectories) {

            properties.setProperty(
                    "dir." + directory,
                    "true"
            );
        }

        for (Map.Entry<String, String> entry :
                updatedLocations.entrySet()) {

            properties.setProperty(
                    "file." + entry.getKey(),
                    entry.getValue()
            );
        }

        Path temporary = null;

        try {

            temporary = Files.createTempFile(
                    directoryFile.getParent(),
                    "directories-",
                    ".tmp"
            );

            try (FileOutputStream output =
                         new FileOutputStream(
                                 temporary.toFile())) {

                properties.store(
                        output,
                        "NEXUS Cloud directory registry"
                );

                output.flush();

                output.getFD().sync();
            }

            Files.move(
                    temporary,
                    directoryFile,
                    StandardCopyOption.REPLACE_EXISTING,
                    StandardCopyOption.ATOMIC_MOVE
            );

        } catch (IOException e) {

            throw new RemoteException(
                    "Unable to persist directories", e
            );

        } finally {

            if (temporary != null) {

                try {

                    Files.deleteIfExists(temporary);

                } catch (IOException e) {

                    System.err.println(
                            "[DIRECTORY WARNING] "
                            + e.getMessage()
                    );
                }
            }
        }
    }

    private Map<String, String> activeLocations()
            throws RemoteException {

        Set<String> activeIds = new HashSet<>();

        for (FileMetadata file : master.listFiles()) {

            activeIds.add(file.fileId());
        }

        Map<String, String> result =
                new HashMap<>(fileLocations);

        result.keySet().retainAll(activeIds);

        return result;
    }

    private void persistAndApply(
            Set<String> updatedDirectories,
            Map<String, String> updatedLocations
    ) throws RemoteException {

        save(updatedDirectories, updatedLocations);

        directories.clear();
        directories.addAll(updatedDirectories);

        fileLocations.clear();
        fileLocations.putAll(updatedLocations);
    }

    @Override
    public synchronized void createDirectory(
            String path
    ) throws RemoteException {

        String directory = normalize(path);

        if (directories.contains(directory)) {
            return;
        }

        requireDirectory(parentOf(directory));

        Set<String> updatedDirectories =
                new HashSet<>(directories);

        updatedDirectories.add(directory);

        persistAndApply(
                updatedDirectories,
                activeLocations()
        );

        System.out.println(
                "[DIRECTORY CREATED] " + directory
        );
    }

    @Override
    public synchronized List<String> listDirectories() {

        return directories.stream()
                .sorted()
                .toList();
    }

    @Override
    public synchronized List<String> listSubdirectories(
            String path
    ) throws RemoteException {

        String directory = normalize(path);

        requireDirectory(directory);

        return directories.stream()
                .filter(candidate ->
                        !candidate.equals("/")
                        && !candidate.equals(directory)
                        && parentOf(candidate)
                                .equals(directory))
                .sorted()
                .toList();
    }

    @Override
    public synchronized void moveFile(
            String fileId,
            String directory
    ) throws RemoteException {

        String target = normalize(directory);

        requireDirectory(target);

        FileMetadata file = master.getFile(fileId);

        Map<String, String> updatedLocations =
                activeLocations();

        updatedLocations.put(fileId, target);

        persistAndApply(
                new HashSet<>(directories),
                updatedLocations
        );

        System.out.println(
                "[FILE MOVED] "
                + file.fileName()
                + " -> " + target
        );
    }

    @Override
    public synchronized String getFileDirectory(
            String fileId
    ) throws RemoteException {

        master.getFile(fileId);

        return fileLocations.getOrDefault(
                fileId,
                "/"
        );
    }

    @Override
    public synchronized List<FileMetadata> listFiles(
            String directory
    ) throws RemoteException {

        String target = normalize(directory);

        requireDirectory(target);

        List<FileMetadata> result =
                new ArrayList<>();

        for (FileMetadata file : master.listFiles()) {

            String location =
                    fileLocations.getOrDefault(
                            file.fileId(),
                            "/"
                    );

            if (target.equals(location)) {

                result.add(file);
            }
        }

        result.sort(
                Comparator.comparing(
                        FileMetadata::fileName
                )
        );

        return result;
    }

    @Override
    public synchronized void deleteDirectory(
            String path
    ) throws RemoteException {

        String directory = normalize(path);

        requireDirectory(directory);

        if (directory.equals("/")) {

            throw new RemoteException(
                    "Root directory cannot be deleted"
            );
        }

        boolean hasChildren =
                directories.stream()
                        .anyMatch(candidate ->
                                candidate.startsWith(
                                        directory + "/"));

        if (hasChildren) {

            throw new RemoteException(
                    "Directory contains subdirectories"
            );
        }

        if (!listFiles(directory).isEmpty()) {

            throw new RemoteException(
                    "Directory is not empty"
            );
        }

        Set<String> updatedDirectories =
                new HashSet<>(directories);

        updatedDirectories.remove(directory);

        persistAndApply(
                updatedDirectories,
                activeLocations()
        );

        System.out.println(
                "[DIRECTORY DELETED] " + directory
        );
    }
}