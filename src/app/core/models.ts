// API contracts mirrored from the Go DTOs.

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  access_expires_at: string;
}

export interface MeResponse {
  id: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
}

export type Role = 'admin' | 'operator' | 'viewer';

export interface UserResponse {
  id: string;
  email: string;
  role: Role;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserListResponse {
  items: UserResponse[];
  total: number;
  page: number;
  size: number;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role: Role;
}

export interface UpdateUserRequest {
  role?: Role;
  active?: boolean;
  password?: string;
}

export interface ResourcesDTO {
  cpu_reservation: number;
  cpu_limit: number;
  mem_reservation: number;
  mem_limit: number;
}

export interface UpdateConfigDTO {
  parallelism: number;
  delay_seconds: number;
  failure_action: string;
  monitor_seconds: number;
  max_failure_ratio: number;
  order: string;
}

/** Swarm placement: hard constraints, spread preferences, max tasks per node. */
export interface PlacementDTO {
  constraints: string[];
  preferences: string[];
  max_replicas_per_node: number;
}

export type ServiceStatus = 'draft' | 'deployed' | 'removed';

export interface ServiceResponse {
  id: string;
  cluster_id?: string;
  hive_id?: string;
  name: string;
  description: string;
  image: string;
  tag: string;
  full_image: string;
  replicas: number;
  command: string[];
  entrypoint: string[];
  resources: ResourcesDTO;
  placement: PlacementDTO;
  update_config: UpdateConfigDTO;
  status: ServiceStatus;
  swarm_service_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceListResponse {
  items: ServiceResponse[];
  total: number;
  page: number;
  size: number;
}

export interface CreateServiceRequest {
  name: string;
  hive?: string;
  description?: string;
  image: string;
  tag?: string;
  replicas?: number;
  resources?: Partial<ResourcesDTO>;
  update_config?: UpdateConfigDTO;
}

export interface UpdateServiceRequest {
  description?: string;
  image?: string;
  tag?: string;
  replicas?: number;
  update_config?: UpdateConfigDTO;
}

/** Platform defaults for the Swarm rolling-update strategy (F-V1-05). */
export const DEFAULT_UPDATE_CONFIG: UpdateConfigDTO = {
  parallelism: 1,
  delay_seconds: 10,
  failure_action: 'rollback',
  monitor_seconds: 30,
  max_failure_ratio: 0,
  order: 'start-first',
};

export interface TaskNetwork {
  name: string;
  address: string;
}

export interface TaskState {
  id: string;
  container_id?: string;
  node: string;
  image?: string;
  slot: number;
  current_state: string;
  desired_state: string;
  message?: string;
  error_message?: string;
  exit_code?: number;
  pid?: number;
  networks?: TaskNetwork[];
  created_at: string;
  updated_at: string;
}

/** Aggregated replica counts from GET /services/{id}/status (F-MVP-10). */
export interface ServiceLiveStatus {
  running: number;
  desired: number;
  pending: number;
  failed: number;
  updating: boolean;
  /** True when the swarm service was removed out-of-band (e.g. `docker service rm`). */
  externally_removed?: boolean;
}

/** Per-task detail from GET /services/{id}/tasks (F-MVP-10). */
export interface ServiceTasksResponse {
  tasks: TaskState[];
}

/** A single environment variable (F-MVP-04). Secret values come back masked. */
export interface EnvVar {
  key: string;
  value: string;
  is_secret: boolean;
}

export interface EnvVarsResponse {
  vars: EnvVar[];
  count: number;
}

export interface SetEnvVarsRequest {
  vars: EnvVar[];
}

export type DeploymentStatus = 'pending' | 'in_progress' | 'succeeded' | 'failed' | 'rolled_back';

export interface DeploymentResponse {
  id: string;
  service_id: string;
  user_id?: string;
  image_tag: string;
  trigger: string;
  status: DeploymentStatus;
  error_message?: string;
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
}

export interface DeploymentListResponse {
  items: DeploymentResponse[];
  total: number;
  page: number;
  size: number;
}

// ─── Service snapshots (point-in-time restore points) ────────────────────────

export interface SnapshotSummary {
  full_image: string;
  replicas: number;
  env_count: number;
  network_count: number;
  secret_count: number;
  config_count: number;
  mount_count: number;
}

export interface SnapshotEnvVar {
  key: string;
  value: string; // masked when is_secret
  is_secret: boolean;
}

export interface SnapshotNetwork {
  name: string;
  subnet?: string;
}

export interface SnapshotSecretRef {
  name: string;
  version: number;
  target_path?: string;
  checksum: string;
}

export interface SnapshotConfigRef {
  name: string;
  version: number;
  target_path?: string;
  checksum: string;
}

export interface SnapshotMount {
  type: string;
  source?: string;
  target: string;
  read_only: boolean;
}

export interface SnapshotDetail {
  name: string;
  description: string;
  image: string;
  tag: string;
  replicas: number;
  command: string[];
  entrypoint: string[];
  hive_id?: string;
  env_vars: SnapshotEnvVar[];
  networks: SnapshotNetwork[];
  secrets: SnapshotSecretRef[];
  configs: SnapshotConfigRef[];
  mounts: SnapshotMount[];
}

export interface SnapshotResponse {
  id: string;
  service_id: string;
  label?: string;
  created_by?: string;
  schema_version: number;
  created_at: string;
  summary: SnapshotSummary;
  detail?: SnapshotDetail;
}

export interface SnapshotListResponse {
  items: SnapshotResponse[];
  total: number;
  page: number;
  size: number;
}

export interface CreateSnapshotRequest {
  label?: string;
}

export interface RollbackResponse {
  deployment: DeploymentResponse;
  warnings: string[];
}

// ─── Networks ────────────────────────────────────────────────────────────────

export interface NetworkResponse {
  id: string;
  cluster_id?: string;
  name: string;
  driver: string;
  scope: string;
  subnet?: string;
  attachable: boolean;
  external: boolean;
  swarm_id?: string;
  created_at: string;
}

export interface NetworkListResponse {
  items: NetworkResponse[];
  total: number;
  page: number;
  size: number;
}

export interface CreateNetworkRequest {
  name: string;
  subnet?: string;
  attachable?: boolean;
  external?: boolean;
}

export interface SwarmNetworkInfo {
  id: string;
  name: string;
  scope: string;
  driver: string;
  subnet?: string;
}

// ─── Volumes & mounts (F-V2-06) ──────────────────────────────────────────────

export interface VolumeResponse {
  id: string;
  cluster_id?: string;
  name: string;
  driver: string;
  created_at: string;
}

export interface VolumeListResponse {
  items: VolumeResponse[];
  total: number;
  page: number;
  size: number;
}

export interface CreateVolumeRequest {
  name: string;
  driver?: string;
}

export interface SwarmVolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
  scope: string;
}

export type MountType = 'volume' | 'bind' | 'tmpfs';

export interface MountDTO {
  type: MountType;
  source: string;
  target: string;
  read_only: boolean;
}

export interface SetMountsRequest {
  mounts: MountDTO[];
}

export interface MountsResponse {
  mounts: MountDTO[];
  warnings: string[];
}

export type PortProtocol = 'tcp' | 'udp' | 'sctp';
export type PublishMode = 'ingress' | 'host';

export interface PortDTO {
  target_port: number;
  published_port: number;
  protocol: PortProtocol;
  mode: PublishMode;
}

export interface SetPortsRequest {
  ports: PortDTO[];
}

export interface PortsResponse {
  ports: PortDTO[];
}

// ─── Hives (projets) ─────────────────────────────────────────────────────────

export interface HiveResponse {
  id: string;
  name: string;
  description: string;
  color: string;
  service_count: number;
  created_at: string;
  updated_at: string;
}

export interface HiveListResponse {
  items: HiveResponse[];
  total: number;
  page: number;
  size: number;
}

export interface CreateHiveRequest {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateHiveRequest {
  name: string;
  description?: string;
  color?: string;
}

// ─── Service templates (F-V2-07) ─────────────────────────────────────────────

export type LockableField =
  | 'image'
  | 'tag'
  | 'replicas'
  | 'resources'
  | 'update_config'
  | 'placement'
  | 'networks';

export interface TemplateSpecDTO {
  image: string;
  tag: string;
  replicas: number;
  resources: ResourcesDTO;
  update_config: UpdateConfigDTO;
  placement: PlacementDTO;
  network_ids: string[];
}

export interface TemplateResponse {
  id: string;
  name: string;
  description: string;
  version: number;
  spec: TemplateSpecDTO;
  locked_fields: LockableField[];
  created_at: string;
  updated_at: string;
}

export interface TemplateListResponse {
  items: TemplateResponse[];
  total: number;
  page: number;
  size: number;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  spec: TemplateSpecDTO;
  locked_fields: LockableField[];
}

export interface UpdateTemplateRequest {
  description?: string;
  spec: TemplateSpecDTO;
  locked_fields: LockableField[];
}

export interface InstantiateTemplateRequest {
  name: string;
  description?: string;
  tag?: string;
  replicas?: number;
  resources?: ResourcesDTO;
}

// ─── Cluster dashboard ───────────────────────────────────────────────────────

export interface ClusterSummary {
  reachable: boolean;
  node_total: number;
  managers: number;
  workers: number;
  ready_nodes: number;
  total_cpus: number;
  total_memory_bytes: number;
  leader_host: string;
  engine_version: string;
}

export interface NodeInfo {
  id: string;
  hostname: string;
  role: 'manager' | 'worker' | string;
  leader: boolean;
  availability: string;
  state: string;
  addr: string;
  engine_version: string;
  cpus: number;
  memory_bytes: number;
  platform: string;
  /** Agent clusters only: true when this node has a live agent tunnel. */
  agent_connected?: boolean;
}

export interface ServiceSummary {
  total: number;
  draft: number;
  deployed: number;
  removed: number;
}

export interface ActivitySummary {
  total_deployments: number;
  in_progress: number;
  succeeded: number;
  failed: number;
}

export interface CatalogSummary {
  networks: number;
  secrets: number;
  configs: number;
}

export interface ClusterOverview {
  cluster: ClusterSummary;
  nodes: NodeInfo[];
  services: ServiceSummary;
  activity: ActivitySummary;
  catalog: CatalogSummary;
}

// ─── Cluster management (multi-cluster) ──────────────────────────────────────

export type ClusterType = 'swarm';
export type ClusterStatus = 'unknown' | 'reachable' | 'unreachable';
export type ConnectionMode = 'direct' | 'agent';
export type AgentStatus = 'pending' | 'online' | 'offline';

export interface ClusterResponse {
  id: string;
  name: string;
  type: ClusterType | string;
  connection_mode: ConnectionMode | string;
  endpoint?: string;
  is_default: boolean;
  status: ClusterStatus | string;
  labels?: Record<string, string>;
  tls_enabled: boolean;
  agent_status?: AgentStatus | string;
  agent_last_seen?: string;
  created_at: string;
  updated_at: string;
}

/** Returned by POST /clusters/:id/enroll — token shown once + deploy command.
 *  When the CA is configured, also carries the agent's mTLS client certificate. */
export interface EnrollClusterResponse {
  cluster_id: string;
  cluster_name: string;
  token: string;
  command: string;
  install_command?: string;
  hub_addr?: string;
  client_cert?: string;
  client_key?: string;
  ca_cert?: string;
}

export interface ClusterListResponse {
  items: ClusterResponse[];
  total: number;
  page: number;
  size: number;
}

export interface CreateClusterRequest {
  name: string;
  type?: ClusterType | string;
  endpoint?: string;
  labels?: Record<string, string>;
  ca_cert?: string;
  client_cert?: string;
  client_key?: string;
}

export interface UpdateClusterRequest {
  name?: string;
  endpoint?: string;
  labels?: Record<string, string>;
  ca_cert?: string;
  client_cert?: string;
  client_key?: string;
}

// ─── Service attachments ─────────────────────────────────────────────────────

export interface ServiceSecretResponse {
  secret_id: string;
  name: string;
  target_path: string;
}

export interface ServiceConfigResponse {
  config_id: string;
  name: string;
  target_path: string;
}

// ─── Configs ─────────────────────────────────────────────────────────────────

export interface ConfigResponse {
  id: string;
  cluster_id?: string;
  name: string;
  target_path: string;
  current_version: number;
  created_at: string;
  updated_at: string;
}

export interface ConfigListResponse {
  items: ConfigResponse[];
  total: number;
  page: number;
  size: number;
}

export interface CreateConfigRequest {
  name: string;
  target_path?: string;
  content: string;
  comment?: string;
}

export interface ConfigVersionResponse {
  version: number;
  content: string;
  comment: string;
  created_by?: string;
  created_at: string;
}

export interface AddConfigVersionRequest {
  content: string;
  comment: string;
}

// ─── Config versioning (F-V2-08) ─────────────────────────────────────────────

export type DiffOp = 'equal' | 'add' | 'del';

export interface DiffLine {
  op: DiffOp;
  text: string;
  old_line: number;
  new_line: number;
}

export interface ConfigDiffResponse {
  from_version: number;
  to_version: number;
  lines: DiffLine[];
}

export interface ImpactedService {
  service_id: string;
  name: string;
  status: string;
}

// ─── Secrets ─────────────────────────────────────────────────────────────────

export interface SecretResponse {
  id: string;
  cluster_id?: string;
  name: string;
  target_path: string;
  current_version: number;
  checksum: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SecretListResponse {
  items: SecretResponse[];
  total: number;
  page: number;
  size: number;
}

export interface CreateSecretRequest {
  name: string;
  target_path?: string;
  value: string;
}
