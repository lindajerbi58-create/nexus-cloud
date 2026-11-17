package com.nexuscloud.common.rmi;

import com.nexuscloud.common.model.StorageNodeInfo;
import java.rmi.Remote;
import java.rmi.RemoteException;
import java.util.List;

public interface MasterService extends Remote {

    String ping() throws RemoteException;

    void registerNode(StorageNodeInfo node)
            throws RemoteException;

    List<StorageNodeInfo> getStorageNodes()
            throws RemoteException;
}