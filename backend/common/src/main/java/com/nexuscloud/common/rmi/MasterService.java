package com.nexuscloud.common.rmi;

import com.nexuscloud.common.model.StorageNodeInfo;
import com.nexuscloud.common.model.FileMetadata;

import java.rmi.Remote;
import java.rmi.RemoteException;
import java.util.List;

public interface MasterService extends Remote {

    String ping() throws RemoteException;

    void registerNode(StorageNodeInfo node)
            throws RemoteException;

    List<StorageNodeInfo> getStorageNodes()
            throws RemoteException;

    default void registerFile(FileMetadata file)
            throws RemoteException {
        throw new RemoteException("Not implemented");
    }

    default FileMetadata getFile(String fileId)
            throws RemoteException {
        throw new RemoteException("Not implemented");
    }

    default List<FileMetadata> listFiles()
            throws RemoteException {
        throw new RemoteException("Not implemented");
    }
}