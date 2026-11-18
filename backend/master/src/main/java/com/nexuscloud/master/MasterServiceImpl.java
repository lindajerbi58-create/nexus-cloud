package com.nexuscloud.master;

import com.nexuscloud.common.model.StorageNodeInfo;
import com.nexuscloud.common.model.FileMetadata;
import com.nexuscloud.common.model.NodeHealthInfo;
import com.nexuscloud.common.model.NodeStatus;
import com.nexuscloud.common.rmi.MasterService;

import java.io.IOException;
import java.nio.file.Path;
import java.rmi.RemoteException;
import java.rmi.server.UnicastRemoteObject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class MasterServiceImpl
        extends UnicastRemoteObject
        implements MasterService {

    private static final long HEARTBEAT_TIMEOUT = 10000;

    private final Map<String, NodeHealthInfo> nodes =
            new ConcurrentHashMap<>();

    private final Map<String, FileMetadata> files =
            new ConcurrentHashMap<>();

    private final Object metadataLock =
            new Object();

    private final MetadataStore metadataStore;

    private final ReplicationManager replicationManager =
            new ReplicationManager();

    private final ScheduledExecutorService monitor =
            Executors.newSingleThreadScheduledExecutor(task -> {

                Thread thread =
                        new Thread(task, "failure-detector");

                thread.setDaemon(true);

                return thread;
            });

    private final ScheduledExecutorService healingScheduler =
            Executors.newSingleThreadScheduledExecutor(task -> {

                Thread thread =
                        new Thread(task, "self-healing");

                thread.setDaemon(true);

                return thread;
            });

    public MasterServiceImpl() throws RemoteException {

        super();

        try {

            metadataStore =
                    new MetadataStore(
                            Path.of(
                                    "data",
                                    "master",
                                    "metadata.bin"
                            )
                    );

            files.putAll(metadataStore.load());

        } catch (IOException e) {

            UnicastRemoteObject.unexportObject(
                    this,
                    true
            );

            throw new RemoteException(
                    "Metadata initialization failed",
                    e
            );
        }

        monitor.scheduleAtFixedRate(
                this::detectFailures,
                2,
                2,
                TimeUnit.SECONDS
        );

        healingScheduler.scheduleWithFixedDelay(
                this::runSelfHealing,
                5,
                5,
                TimeUnit.SECONDS
        );

        System.out.println(
                "[SELF-HEALING] Recovery service started"
        );
    }

    @Override
    public String ping() {

        return "NEXUS Cloud Master is online";
    }

    @Override
    public void registerNode(StorageNodeInfo node) {

        validateNode(node);

        nodes.compute(node.nodeId(), (id, previous) -> {

            System.out.println(
                    "[REGISTER] Storage node: "
                    + node.nodeId()
                    + " | "
                    + node.host()
                    + ":" + node.port()
            );

            if (previous != null
                    && previous.status() == NodeStatus.OFFLINE) {

                System.out.println(
                        "[RECOVERY] "
                        + id + " is back online"
                );
            }

            return new NodeHealthInfo(
                    node,
                    NodeStatus.ONLINE,
                    Instant.now()
            );
        });
    }

    private void validateNode(StorageNodeInfo node) {

        if (node == null
                || node.nodeId() == null
                || node.nodeId().isBlank()) {

            throw new IllegalArgumentException(
                    "Invalid storage node"
            );
        }
    }

    @Override
    public void heartbeat(StorageNodeInfo node) {

        validateNode(node);

        nodes.compute(node.nodeId(), (id, previous) -> {

            if (previous == null) {

                System.out.println(
                        "[REGISTER] " + id
                );

            } else if (
                    previous.status() == NodeStatus.OFFLINE) {

                System.out.println(
                        "[RECOVERY] "
                        + id + " is back online"
                );
            }

            return new NodeHealthInfo(
                    node,
                    NodeStatus.ONLINE,
                    Instant.now()
            );
        });
    }

    private void detectFailures() {

        long now = System.currentTimeMillis();

        for (String nodeId : nodes.keySet()) {

            nodes.computeIfPresent(
                    nodeId,
                    (id, health) -> {

                        long elapsed =
                                now - health.lastHeartbeat()
                                        .toEpochMilli();

                        if (elapsed > HEARTBEAT_TIMEOUT
                                && health.status()
                                == NodeStatus.ONLINE) {

                            System.out.println(
                                    "[FAILURE DETECTED] "
                                    + id + " is offline"
                            );

                            return new NodeHealthInfo(
                                    health.node(),
                                    NodeStatus.OFFLINE,
                                    health.lastHeartbeat()
                            );
                        }

                        return health;
                    }
            );
        }
    }

    private void runSelfHealing() {

        try {

            Map<String, FileMetadata> original;

            synchronized (metadataLock) {

                original = new HashMap<>(files);
            }

            Map<String, FileMetadata> repaired =
                    new HashMap<>(original);

            replicationManager.repair(
                    repaired,
                    getNodeHealth()
            );

            synchronized (metadataLock) {

                Map<String, FileMetadata> updated =
                        new HashMap<>(files);

                for (String id : original.keySet()) {

                    FileMetadata before =
                            original.get(id);

                    FileMetadata after =
                            repaired.get(id);

                    if (after != null
                            && !before.equals(after)
                            && before.equals(files.get(id))) {

                        updated.put(id, after);
                    }
                }

                if (!updated.equals(files)) {

                    metadataStore.save(updated);

                    files.putAll(updated);

                    System.out.println(
                            "[PERSISTENCE] Repaired metadata saved"
                    );
                }
            }

        } catch (Exception e) {

            System.err.println(
                    "[SELF-HEALING ERROR] "
                    + e.getMessage()
            );
        }
    }

    @Override
    public List<NodeHealthInfo> getNodeHealth() {

        return new ArrayList<>(nodes.values());
    }

    @Override
    public List<StorageNodeInfo> getStorageNodes() {

        return nodes.values()
                .stream()
                .map(NodeHealthInfo::node)
                .toList();
    }

    @Override
    public void registerFile(FileMetadata file)
            throws RemoteException {

        if (file == null
                || file.fileId() == null
                || file.fileId().isBlank()) {

            throw new RemoteException(
                    "Invalid file metadata"
            );
        }

        synchronized (metadataLock) {

            if (files.containsKey(file.fileId())) {

                throw new RemoteException(
                        "File identifier already exists"
                );
            }

            Map<String, FileMetadata> updated =
                    new HashMap<>(files);

            updated.put(file.fileId(), file);

            try {

                metadataStore.save(updated);

                files.put(file.fileId(), file);

            } catch (IOException e) {

                throw new RemoteException(
                        "Unable to persist file metadata",
                        e
                );
            }
        }

        System.out.println(
                "[FILE REGISTERED] "
                + file.fileName()
                + " | ID: " + file.fileId()
                + " | Blocks: " + file.getBlockCount()
                + " | Replicas: " + file.getTotalReplicas()
        );
    }

    @Override
    public FileMetadata getFile(String fileId)
            throws RemoteException {

        synchronized (metadataLock) {

            FileMetadata file = files.get(fileId);

            if (file == null) {

                throw new RemoteException(
                        "File not found: " + fileId
                );
            }

            return file;
        }
    }

    @Override
    public List<FileMetadata> listFiles() {

        synchronized (metadataLock) {

            return new ArrayList<>(files.values());
        }
    }
}