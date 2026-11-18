package main.java.com.nexuscloud.api.service;

import com.nexuscloud.client.DistributedFileClient;
import com.nexuscloud.common.model.FileMetadata;
import com.nexuscloud.common.model.NodeHealthInfo;
import com.nexuscloud.common.model.NodeStatus;
import com.nexuscloud.common.rmi.MasterService;
import com.nexuscloud.common.rmi.DirectoryService;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.rmi.registry.LocateRegistry;
import java.rmi.registry.Registry;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Set;
import java.util.Comparator;

@Service
public class NexusService {

    private final String host;
    private final int port;

    public NexusService(
            @Value("${nexus.master.host}") String host,
            @Value("${nexus.master.port}") int port
    ) {

        this.host = host;
        this.port = port;
    }

    private Registry registry() throws Exception {

        return LocateRegistry.getRegistry(
                host,
                port
        );
    }

    public MasterService master()
            throws Exception {

        return (MasterService) registry()
                .lookup("NexusMaster");
    }

    public DirectoryService directory()
            throws Exception {

        return (DirectoryService) registry()
                .lookup("NexusDirectory");
    }

    private DistributedFileClient client()
            throws Exception {

        return new DistributedFileClient(
                host,
                port
        );
    }

    public List<FileMetadata> listFiles()
            throws Exception {

        return master().listFiles();
    }

    public FileMetadata getFile(String id)
            throws Exception {

        return master().getFile(id);
    }

    private String safeFilename(String name) {

        if (name == null || name.isBlank()) {
            return "uploaded-file.bin";
        }

        String normalized =
                name.replace('\\', '/');

        String result = normalized.substring(
                normalized.lastIndexOf('/') + 1
        );

        if (result.isBlank()
                || result.equals(".")
                || result.equals("..")
                || result.length() > 200
                || result.matches(".*[\\p{Cntrl}<>:\"|?*].*")) {

            throw new IllegalArgumentException(
                    "Invalid file name"
            );
        }

        return result;
    }

    public FileMetadata upload(
            MultipartFile file,
            String folder
    ) throws Exception {

        if (file == null || file.isEmpty()) {

            throw new IllegalArgumentException(
                    "File must not be empty"
            );
        }

        String target = folder == null
                || folder.isBlank()
                ? "/" : folder;

        directory().listFiles(target);

        String name = safeFilename(
                file.getOriginalFilename()
        );

        Path temporaryDirectory =
                Files.createTempDirectory(
                        "nexus-upload-"
                );

        Path temporaryFile =
                temporaryDirectory.resolve(name);

        String fileId = null;

        try {

            file.transferTo(temporaryFile);

            fileId = client().upload(
                    temporaryFile
            );

            if (!target.equals("/")) {

                directory().moveFile(
                        fileId,
                        target
                );
            }

            return getFile(fileId);

        } catch (Exception e) {

            if (fileId != null) {

                try {
                    master().deleteFile(fileId);
                } catch (Exception cleanupError) {
                    e.addSuppressed(cleanupError);
                }
            }

            throw e;

        } finally {

            try {
                Files.deleteIfExists(temporaryFile);
                Files.deleteIfExists(temporaryDirectory);
            } catch (Exception cleanupError) {
                System.err.println(
                        "[UPLOAD CLEANUP] "
                        + cleanupError.getMessage()
                );
            }
        }
    }

    public byte[] download(String id)
            throws Exception {

        Path temporary = Files.createTempFile(
                "nexus-download-",
                ".bin"
        );

        try {

            client().download(
                    id,
                    temporary
            );

            return Files.readAllBytes(
                    temporary
            );

        } finally {

            Files.deleteIfExists(temporary);
        }
    }

    public void deleteFile(String id)
            throws Exception {

        master().deleteFile(id);
    }

    public void moveFile(
            String id,
            String folder
    ) throws Exception {

        directory().moveFile(id, folder);
    }

    public List<String> listDirectories()
            throws Exception {

        return directory().listDirectories();
    }

    public void createDirectory(String path)
            throws Exception {

        directory().createDirectory(path);
    }

    public void deleteDirectory(String path)
            throws Exception {

        directory().deleteDirectory(path);
    }

    public Map<String, Object> directoryContents(
            String path
    ) throws Exception {

        DirectoryService service = directory();

        Map<String, Object> result =
                new HashMap<>();

        result.put("path", path);

        result.put(
                "directories",
                service.listSubdirectories(path)
        );

        result.put(
                "files",
                service.listFiles(path)
        );

        return result;
    }

    public List<NodeHealthInfo> nodes()
            throws Exception {

        return master().getNodeHealth()
                .stream()
                .sorted(
                        Comparator.comparing(
                                node -> node.node().nodeId()
                        )
                )
                .toList();
    }

    public Map<String, Object> clusterStats()
            throws Exception {

        List<NodeHealthInfo> nodes = nodes();

        List<FileMetadata> files = listFiles();

        Set<String> onlineIds =
                new HashSet<>();

        for (NodeHealthInfo node : nodes) {

            if (node.status() == NodeStatus.ONLINE) {

                onlineIds.add(
                        node.node().nodeId()
                );
            }
        }

        long logicalBytes = files.stream()
                .mapToLong(FileMetadata::fileSize)
                .sum();

        long usedBytes = nodes.stream()
                .mapToLong(
                        node -> node.node().usedCapacity()
                )
                .sum();

        long blocks = files.stream()
                .mapToLong(FileMetadata::getBlockCount)
                .sum();

        long replicas = files.stream()
                .mapToLong(FileMetadata::getTotalReplicas)
                .sum();

        long availableReplicas = 0;
        long underReplicatedBlocks = 0;

        for (FileMetadata file : files) {

            for (var block : file.blocks()) {

                long available = block.replicaNodeIds()
                        .stream()
                        .distinct()
                        .filter(onlineIds::contains)
                        .count();

                availableReplicas += available;

                if (available < 2) {
                    underReplicatedBlocks++;
                }
            }
        }

        Map<String, Object> result =
                new HashMap<>();

        result.put("totalNodes", nodes.size());

        result.put("onlineNodes", onlineIds.size());

        result.put(
                "offlineNodes",
                nodes.size() - onlineIds.size()
        );

        result.put("totalFiles", files.size());

        result.put("totalBlocks", blocks);

        result.put("totalReplicas", replicas);

        result.put(
                "availableReplicas",
                availableReplicas
        );

        result.put(
                "underReplicatedBlocks",
                underReplicatedBlocks
        );

        result.put("logicalBytes", logicalBytes);

        result.put("physicalUsedBytes", usedBytes);

        result.put("replicationFactor", 2);

        result.put(
                "status",
                nodes.isEmpty()
                || onlineIds.size() < 2
                || underReplicatedBlocks > 0
                || onlineIds.size() < nodes.size()
                ? "DEGRADED"
                : "HEALTHY"
        );

        return result;
    }
}