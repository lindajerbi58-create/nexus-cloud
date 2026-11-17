package com.nexuscloud.client;

import com.nexuscloud.common.model.BlockMetadata;
import com.nexuscloud.common.model.FileMetadata;
import com.nexuscloud.common.model.StorageNodeInfo;
import com.nexuscloud.common.protocol.StorageProtocol;
import com.nexuscloud.common.rmi.MasterService;
import com.nexuscloud.common.utils.ChecksumUtils;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.rmi.registry.LocateRegistry;
import java.rmi.registry.Registry;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public class DistributedFileClient {

    private final MasterService master;

    public DistributedFileClient(
            String masterHost,
            int masterPort
    ) throws Exception {

        Registry registry =
                LocateRegistry.getRegistry(
                        masterHost,
                        masterPort
                );

        master = (MasterService)
                registry.lookup("NexusMaster");
    }

    public String upload(Path file)
            throws IOException {

        if (!Files.isRegularFile(file)) {

            throw new IOException(
                    "Invalid file: " + file
            );
        }

        List<StorageNodeInfo> nodes =
                NodeSelector.getAvailableNodes(
                        master.getStorageNodes()
                );

        int replicationFactor =
                StorageProtocol.REPLICATION_FACTOR;

        if (nodes.size() < replicationFactor) {

            throw new IOException(
                    "Not enough available storage nodes"
            );
        }

        String fileId = UUID.randomUUID().toString();

        String fileChecksum =
                ChecksumUtils.sha256(file);

        long fileSize = Files.size(file);

        List<BlockMetadata> blocks =
                new ArrayList<>();

        System.out.println(
                "[UPLOAD] " + file.getFileName()
        );

        FileChunker.split(file, (index, data) -> {

            String blockId =
                    fileId + "-" + index;

            String blockChecksum =
                    ChecksumUtils.sha256(data);

            List<StorageNodeInfo> selectedNodes =
                    NodeSelector.selectNodes(
                            nodes,
                            index,
                            replicationFactor
                    );

            List<String> replicas =
                    new ArrayList<>();

            for (StorageNodeInfo node : selectedNodes) {

                StorageClient storage =
                        new StorageClient(
                                node.host(),
                                node.port()
                        );

                storage.putBlock(blockId, data);

                replicas.add(node.nodeId());

                System.out.println(
                        "[REPLICA] Block "
                        + index
                        + " -> "
                        + node.nodeId()
                );
            }

            blocks.add(
                    new BlockMetadata(
                            blockId,
                            index,
                            data.length,
                            blockChecksum,
                            replicas
                    )
            );
        });

        FileMetadata metadata =
                new FileMetadata(
                        fileId,
                        file.getFileName().toString(),
                        fileSize,
                        Instant.now(),
                        fileChecksum,
                        blocks
                );

        master.registerFile(metadata);

        System.out.println(
                "[SUCCESS] File uploaded: " + fileId
        );

        return fileId;
    }

    public void download(
            String fileId,
            Path destination
    ) throws IOException {

        FileMetadata metadata =
                master.getFile(fileId);

        List<StorageNodeInfo> nodes =
                master.getStorageNodes();

        List<BlockMetadata> blocks =
                new ArrayList<>(metadata.blocks());

        blocks.sort(
                Comparator.comparingInt(
                        BlockMetadata::index
                )
        );

        Path target =
                destination.toAbsolutePath();

        Files.createDirectories(target.getParent());

        Path temporary = Files.createTempFile(
                target.getParent(),
                "download-",
                ".tmp"
        );

        try {

            try (OutputStream output =
                         Files.newOutputStream(temporary)) {

                for (BlockMetadata block : blocks) {

                    byte[] data =
                            retrieveBlock(block, nodes);

                    output.write(data);

                    System.out.println(
                            "[DOWNLOAD] Block "
                            + block.index()
                            + " retrieved"
                    );
                }
            }

            if (Files.size(temporary)
                    != metadata.fileSize()) {

                throw new IOException(
                        "File size verification failed"
                );
            }

            String actualChecksum =
                    ChecksumUtils.sha256(temporary);

            if (!actualChecksum.equals(
                    metadata.checksum())) {

                throw new IOException(
                        "File integrity verification failed"
                );
            }

            Files.move(
                    temporary,
                    target,
                    StandardCopyOption.REPLACE_EXISTING
            );

            System.out.println(
                    "[SUCCESS] File downloaded: "
                    + destination
            );

        } finally {

            Files.deleteIfExists(temporary);
        }
    }

    private byte[] retrieveBlock(
            BlockMetadata block,
            List<StorageNodeInfo> nodes
    ) throws IOException {

        for (String nodeId : block.replicaNodeIds()) {

            StorageNodeInfo node = nodes.stream()
                    .filter(n -> n.nodeId().equals(nodeId))
                    .findFirst()
                    .orElse(null);

            if (node == null) {
                continue;
            }

            try {

                StorageClient storage =
                        new StorageClient(
                                node.host(),
                                node.port()
                        );

                byte[] data =
                        storage.getBlock(block.blockId());

                if (data.length != block.size()
                        || !ChecksumUtils.verify(
                                data,
                                block.checksum()
                        )) {

                    System.out.println(
                            "[CORRUPTED] "
                            + block.blockId()
                            + " on " + nodeId
                    );

                    continue;
                }

                System.out.println(
                        "[READ] Block "
                        + block.index()
                        + " from "
                        + nodeId
                );

                return data;

            } catch (IOException e) {

                System.out.println(
                        "[FAILOVER] "
                        + nodeId
                        + " unavailable. Trying replica..."
                );
            }
        }

        throw new IOException(
                "No valid replica available for block "
                + block.blockId()
        );
    }

    public List<FileMetadata> listFiles()
            throws IOException {

        return master.listFiles();
    }
}