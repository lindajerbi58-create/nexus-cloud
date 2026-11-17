package com.nexuscloud.common.protocol;

public final class StorageProtocol {

    public static final String PUT = "PUT";
    public static final String GET = "GET";
    public static final String DELETE = "DELETE";
    public static final String EXISTS = "EXISTS";
    public static final String PING = "PING";

    public static final String OK = "OK";
    public static final String ERROR = "ERROR";

    public static final int DEFAULT_BLOCK_SIZE =
            1024 * 1024;

    public static final int SOCKET_TIMEOUT = 10000;

    public static final int REPLICATION_FACTOR = 2;

    private StorageProtocol() {
    }
}