package com.nexuscloud.common.rmi;

import com.nexuscloud.common.model.FileMetadata;

import java.rmi.Remote;
import java.rmi.RemoteException;
import java.util.List;

public interface DirectoryService extends Remote {

    void createDirectory(String path)
            throws RemoteException;

    void deleteDirectory(String path)
            throws RemoteException;

    List<String> listDirectories()
            throws RemoteException;

    List<String> listSubdirectories(String path)
            throws RemoteException;

    void moveFile(String fileId, String directory)
            throws RemoteException;

    String getFileDirectory(String fileId)
            throws RemoteException;

    List<FileMetadata> listFiles(String directory)
            throws RemoteException;
}