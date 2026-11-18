package com.nexuscloud.master;

import com.nexuscloud.common.model.BlockMetadata;
import com.nexuscloud.common.model.FileMetadata;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.LinkOption;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class GarbageCollector {

    public record OrphanBlock(
            Path path,
            long size
    ) {}

    public List<OrphanBlock> scan(
            Path dataDirectory,
            Map<String, FileMetadata> files
    ) throws IOException {

        Set<String> referencedBlocks =
                new HashSet<>();

        for (FileMetadata file : files.values()) {

            for (BlockMetadata block : file.blocks()) {

                referencedBlocks.add(
                        block.blockId()
                );
            }
        }

        List<OrphanBlock> orphans =
                new ArrayList<>();

        try (var directories =
                     Files.list(dataDirectory)) {

            for (Path nodeDirectory :
                    directories.sorted().toList()) {

                if (!nodeDirectory.getFileName()
                        .toString()
                        .matches("node-[a-zA-Z0-9_-]+")) {

                    continue;
                }

                if (!Files.isDirectory(
                        nodeDirectory,
                        LinkOption.NOFOLLOW_LINKS)) {

                    continue;
                }

                try (var blocks =
                             Files.list(nodeDirectory)) {

                    for (Path blockPath :
                            blocks.sorted().toList()) {

                        if (!Files.isRegularFile(
                                blockPath,
                                LinkOption.NOFOLLOW_LINKS)) {

                            continue;
                        }

                        String name =
                                blockPath.getFileName()
                                        .toString();

                        if (!name.endsWith(".block")) {
                            continue;
                        }

                        String blockId =
                                name.substring(
                                        0,
                                        name.length() - 6
                                );

                        if (!referencedBlocks.contains(
                                blockId)) {

                            orphans.add(
                                    new OrphanBlock(
                                            blockPath,
                                            Files.size(blockPath)
                                    )
                            );
                        }
                    }
                }
            }
        }

        return orphans;
    }

    public Path quarantine(
            Path dataDirectory,
            List<OrphanBlock> orphans
    ) throws IOException {

        if (orphans.isEmpty()) {
            return null;
        }

        Path quarantineRoot =
                dataDirectory.resolve("quarantine");

        Files.createDirectories(
                quarantineRoot
        );

        Path session =
                Files.createTempDirectory(
                        quarantineRoot,
                        "gc-"
                );

        for (OrphanBlock orphan : orphans) {

            String nodeId =
                    orphan.path()
                            .getParent()
                            .getFileName()
                            .toString();

            Path destinationDirectory =
                    session.resolve(nodeId);

            Files.createDirectories(
                    destinationDirectory
            );

            Path destination =
                    destinationDirectory.resolve(
                            orphan.path().getFileName()
                    );

            Files.move(
                    orphan.path(),
                    destination
            );

            System.out.println(
                    "[QUARANTINED] "
                    + orphan.path()
            );
        }

        return session;
    }

    public static void main(String[] args) {

        if (args.length != 1
                || (!args[0].equals("--dry-run")
                && !args[0].equals("--apply"))) {

            System.err.println(
                    "Usage: GarbageCollector "
                    + "--dry-run | --apply"
            );

            System.exit(1);
        }

        try {

            Path dataDirectory =
                    Path.of("data");

            Path metadataFile =
                    dataDirectory.resolve(
                            "master/metadata.bin"
                    );

            if (!Files.isRegularFile(metadataFile)) {

                throw new IOException(
                        "Metadata file is missing. "
                        + "Cleanup refused."
                );
            }

            MetadataStore store =
                    new MetadataStore(metadataFile);

            Map<String, FileMetadata> files =
                    store.load();

            boolean apply =
                    args[0].equals("--apply");

            if (apply && files.isEmpty()) {

                throw new IOException(
                        "Metadata registry is empty. "
                        + "Cleanup refused for safety."
                );
            }

            GarbageCollector collector =
                    new GarbageCollector();

            List<OrphanBlock> orphans =
                    collector.scan(
                            dataDirectory,
                            files
                    );

            long totalBytes = 0;

            System.out.println(
                    "======= NEXUS GARBAGE COLLECTOR ======="
            );

            System.out.println(
                    "Mode: " + args[0]
            );

            System.out.println(
                    "Registered files: " + files.size()
            );

            for (OrphanBlock orphan : orphans) {

                totalBytes += orphan.size();

                System.out.println(
                        "[ORPHAN] "
                        + orphan.path()
                        + " | "
                        + orphan.size()
                        + " bytes"
                );
            }

            System.out.println(
                    "Orphan blocks: " + orphans.size()
            );

            System.out.println(
                    "Orphan bytes: " + totalBytes
            );

            if (apply) {

                Path destination =
                        collector.quarantine(
                                dataDirectory,
                                orphans
                        );

                if (destination != null) {

                    System.out.println(
                            "[QUARANTINE] "
                            + destination.toAbsolutePath()
                    );
                }

                System.out.println(
                        "[SUCCESS] Cleanup completed"
                );

            } else {

                System.out.println(
                        "[DRY RUN] No blocks modified"
                );
            }

        } catch (Exception e) {

            System.err.println(
                    "[GC ERROR] " + e.getMessage()
            );

            System.exit(1);
        }
    }
}