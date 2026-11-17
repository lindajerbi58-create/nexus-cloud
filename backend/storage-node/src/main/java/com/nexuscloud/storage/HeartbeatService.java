package com.nexuscloud.storage;

import com.nexuscloud.common.model.StorageNodeInfo;
import com.nexuscloud.common.rmi.MasterService;

import java.rmi.registry.LocateRegistry;
import java.rmi.registry.Registry;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class HeartbeatService implements AutoCloseable {

    private final String nodeId;
    private final String host;
    private final int port;

    private final BlockStorage storage;

    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(task -> {

                Thread thread =
                        new Thread(task, "heartbeat-sender");

                thread.setDaemon(true);

                return thread;
            });

    public HeartbeatService(
            String nodeId,
            String host,
            int port,
            BlockStorage storage
    ) {

        this.nodeId = nodeId;
        this.host = host;
        this.port = port;
        this.storage = storage;
    }

    public void start() {

        scheduler.scheduleAtFixedRate(
                this::sendHeartbeat,
                0,
                3,
                TimeUnit.SECONDS
        );

        System.out.println(
                "[HEARTBEAT] Service started"
        );
    }

    private void sendHeartbeat() {

        try {

            Registry registry =
                    LocateRegistry.getRegistry(
                            "localhost",
                            1099
                    );

            MasterService master =
                    (MasterService) registry.lookup(
                            "NexusMaster"
                    );

            StorageNodeInfo info =
                    new StorageNodeInfo(
                            nodeId,
                            host,
                            port,
                            storage.getTotalCapacity(),
                            storage.getUsedCapacity()
                    );

            master.heartbeat(info);

            System.out.println(
                    "[HEARTBEAT] Sent by " + nodeId
            );

        } catch (Exception e) {

            System.err.println(
                    "[HEARTBEAT ERROR] "
                    + e.getMessage()
            );
        }
    }

    @Override
    public void close() {

        scheduler.shutdownNow();
    }
}