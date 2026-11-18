package com.nexuscloud.common.rmi;

import com.nexuscloud.common.model.StorageNodeInfo;
import com.nexuscloud.common.model.FileMetadata;
import com.nexuscloud.common.model.NodeHealthInfo;

import java.rmi.Remote;
import java.rmi.RemoteException;
import java.util.List;

public interface MasterService extends Remote {

    String ping() throws RemoteException;

    void registerNode(StorageNodeInfo node)
            throws RemoteException;

    List<StorageNodeInfo> getStorageNodes()
            throws RemoteException;

    void registerFile(FileMetadata file)
            throws RemoteException;

    FileMetadata getFile(String fileId)
            throws RemoteException;

    List<FileMetadata> listFiles()
            throws RemoteException;

    default void heartbeat(StorageNodeInfo node)
            throws RemoteException {

        throw new RemoteException("Not implemented");
    }

    default List<NodeHealthInfo> getNodeHealth()
            throws RemoteException {

        throw new RemoteException("Not implemented");
    }
    default void deleteFile(String fileId)
        throws RemoteException {

    throw new RemoteException("Not implemented");
}
}