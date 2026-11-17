package com.nexuscloud.master;

import com.nexuscloud.common.model.StorageNodeInfo;
import com.nexuscloud.common.model.FileMetadata;
import com.nexuscloud.common.model.NodeHealthInfo;
import com.nexuscloud.common.model.NodeStatus;
import com.nexuscloud.common.rmi.MasterService;

import java.rmi.RemoteException;
import java.rmi.server.UnicastRemoteObject;
import java.time.Instant;
import java.util.ArrayList;
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
                        "[RECOVERY] " + id + " is back online"
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

                System.out.println("[REGISTER] " + id);

            } else if (
                    previous.status() == NodeStatus.OFFLINE) {

                System.out.println(
                        "[RECOVERY] "
                        + id
                        + " is back online"
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
                                    + id
                                    + " is offline"
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

            replicationManager.repair(
                    files,
                    getNodeHealth()
            );

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

        if (files.putIfAbsent(file.fileId(), file) != null) {

            throw new RemoteException(
                    "File identifier already exists"
            );
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

        FileMetadata file = files.get(fileId);

        if (file == null) {

            throw new RemoteException(
                    "File not found: " + fileId
            );
        }

        return file;
    }

    @Override
    public List<FileMetadata> listFiles() {

        return new ArrayList<>(files.values());
    }
}