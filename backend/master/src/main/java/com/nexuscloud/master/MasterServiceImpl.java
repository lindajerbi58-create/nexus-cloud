package com.nexuscloud.master;

import com.nexuscloud.common.model.StorageNodeInfo;
import com.nexuscloud.common.rmi.MasterService;

import java.rmi.RemoteException;
import java.rmi.server.UnicastRemoteObject;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class MasterServiceImpl
        extends UnicastRemoteObject
        implements MasterService {

    private final Map<String, StorageNodeInfo> storageNodes;

    public MasterServiceImpl() throws RemoteException {
        super();
        storageNodes = new ConcurrentHashMap<>();
    }

    @Override
    public String ping() {
        return "NEXUS Cloud Master is online";
    }

    @Override
    public void registerNode(StorageNodeInfo node) {

        if (node == null || node.nodeId() == null
                || node.nodeId().isBlank()) {
            throw new IllegalArgumentException(
                    "Invalid storage node"
            );
        }

        storageNodes.put(node.nodeId(), node);

        System.out.println(
                "[REGISTER] Storage node: "
                + node.nodeId()
                + " | "
                + node.host()
                + ":"
                + node.port()
        );
    }

    @Override
    public List<StorageNodeInfo> getStorageNodes() {
        return new ArrayList<>(storageNodes.values());
    }
}