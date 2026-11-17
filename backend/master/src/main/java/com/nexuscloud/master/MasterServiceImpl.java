package com.nexuscloud.master;

import com.nexuscloud.common.model.StorageNodeInfo;
import com.nexuscloud.common.model.FileMetadata;
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

    private final Map<String, FileMetadata> files;

    public MasterServiceImpl() throws RemoteException {

        super();

        storageNodes = new ConcurrentHashMap<>();
        files = new ConcurrentHashMap<>();
    }

    @Override
    public String ping() {

        return "NEXUS Cloud Master is online";
    }

    @Override
    public void registerNode(StorageNodeInfo node) {

        if (node == null
                || node.nodeId() == null
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
                + ":" + node.port()
        );
    }

    @Override
    public List<StorageNodeInfo> getStorageNodes() {

        return new ArrayList<>(storageNodes.values());
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