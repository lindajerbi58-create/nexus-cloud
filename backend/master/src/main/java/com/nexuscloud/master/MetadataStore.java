package com.nexuscloud.master;

import com.nexuscloud.common.model.FileMetadata;

import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;

public class MetadataStore {

    private final Path metadataFile;

    public MetadataStore(Path metadataFile)
            throws IOException {

        this.metadataFile =
                metadataFile.toAbsolutePath();

        Files.createDirectories(
                this.metadataFile.getParent()
        );
    }

    public synchronized void save(
            Map<String, FileMetadata> files
    ) throws IOException {

        Path temporaryFile =
                Files.createTempFile(
                        metadataFile.getParent(),
                        "metadata-",
                        ".tmp"
                );

        try {

            try (
                    FileOutputStream stream =
                            new FileOutputStream(
                                    temporaryFile.toFile()
                            );

                    ObjectOutputStream output =
                            new ObjectOutputStream(stream)
            ) {

                output.writeObject(
                        new HashMap<>(files)
                );

                output.flush();
                stream.getFD().sync();
            }

            Files.move(
                    temporaryFile,
                    metadataFile,
                    StandardCopyOption.REPLACE_EXISTING,
                    StandardCopyOption.ATOMIC_MOVE
            );

            System.out.println(
                    "[PERSISTENCE] Saved "
                    + files.size()
                    + " file(s)"
            );

        } finally {

            Files.deleteIfExists(temporaryFile);
        }
    }

    public synchronized Map<String, FileMetadata> load()
            throws IOException {

        Map<String, FileMetadata> result =
                new HashMap<>();

        if (!Files.exists(metadataFile)) {

            System.out.println(
                    "[PERSISTENCE] No existing metadata"
            );

            return result;
        }

        try (
                ObjectInputStream input =
                        new ObjectInputStream(
                                Files.newInputStream(
                                        metadataFile
                                )
                        )
        ) {

            Object object = input.readObject();

            if (!(object instanceof Map<?, ?> map)) {

                throw new IOException(
                        "Invalid metadata format"
                );
            }

            for (Map.Entry<?, ?> entry : map.entrySet()) {

                if (!(entry.getKey() instanceof String id)
                        || !(entry.getValue()
                                instanceof FileMetadata file)
                        || !id.equals(file.fileId())) {

                    throw new IOException(
                            "Invalid metadata entry"
                    );
                }

                result.put(id, file);
            }

            System.out.println(
                    "[PERSISTENCE] Restored "
                    + result.size()
                    + " file(s)"
            );

            return result;

        } catch (ClassNotFoundException e) {

            throw new IOException(
                    "Unable to restore metadata",
                    e
            );
        }
    }
}