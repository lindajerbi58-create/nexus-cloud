export type UserRole = "ADMIN" | "USER";

export interface User {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface BlockMetadata {
  blockId: string;
  index: number;
  size: number;
  checksum: string;
  replicaNodeIds: string[];
  replicationCount?: number;
}

export interface FileMetadata {
  fileId: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  checksum: string;
  blocks: BlockMetadata[];
  blockCount?: number;
  totalReplicas?: number;
}

export interface StorageNode {
  nodeId: string;
  host: string;
  port: number;
  totalCapacity: number;
  usedCapacity: number;
  availableCapacity?: number;
}

export type NodeStatus = "ONLINE" | "OFFLINE";

export interface NodeHealth {
  node: StorageNode;
  status: NodeStatus;
  lastHeartbeat: string;
}

export interface ClusterStats {
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  totalFiles: number;
  totalBlocks: number;
  totalReplicas: number;
  availableReplicas: number;
  underReplicatedBlocks: number;
  logicalBytes: number;
  physicalUsedBytes: number;
  replicationFactor: number;
  status: "HEALTHY" | "DEGRADED";
}

export interface DirectoryContents {
  path: string;
  directories: string[];
  files: FileMetadata[];
}

export interface ClusterHealth {
  status: string;
  master: string;
  timestamp: string;
}

export interface ApiError {
  timestamp?: string;
  status: number;
  error?: string;
  message: string;
}