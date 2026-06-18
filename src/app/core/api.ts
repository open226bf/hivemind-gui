import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE } from './config';
import {
  AddConfigVersionRequest,
  ClusterListResponse,
  ClusterOverview,
  ClusterResponse,
  CreateClusterRequest,
  EnrollClusterResponse,
  UpdateClusterRequest,
  ConfigDiffResponse,
  ConfigListResponse,
  ConfigResponse,
  ConfigVersionResponse,
  ImpactedService,
  CreateConfigRequest,
  CreateNetworkRequest,
  CreateSecretRequest,
  CreateHiveRequest,
  CreateServiceRequest,
  CreateTemplateRequest,
  CreateVolumeRequest,
  HiveListResponse,
  HiveResponse,
  UpdateHiveRequest,
  InstantiateTemplateRequest,
  MountsResponse,
  TemplateListResponse,
  TemplateResponse,
  UpdateTemplateRequest,
  PlacementDTO,
  PortsResponse,
  ResourcesDTO,
  SetMountsRequest,
  SetPortsRequest,
  SwarmNetworkInfo,
  SwarmVolumeInfo,
  VolumeListResponse,
  VolumeResponse,
  DeploymentListResponse,
  DeploymentResponse,
  EnvVarsResponse,
  NetworkListResponse,
  NetworkResponse,
  SecretListResponse,
  SecretResponse,
  ServiceConfigResponse,
  ServiceListResponse,
  ServiceLiveStatus,
  ServiceResponse,
  ServiceSecretResponse,
  ServiceTasksResponse,
  SetEnvVarsRequest,
  CreateSnapshotRequest,
  SnapshotListResponse,
  SnapshotResponse,
  RollbackResponse,
  UpdateServiceRequest,
  CreateUserRequest,
  UpdateUserRequest,
  UserListResponse,
  UserResponse,
} from './models';

@Injectable({ providedIn: 'root' })
export class ServicesApi {
  private readonly http = inject(HttpClient);

  list(
    page = 1,
    size = 50,
    opts: { hive_id?: string; unassigned?: boolean } = {},
  ): Observable<ServiceListResponse> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (opts.unassigned) params = params.set('unassigned', 'true');
    else if (opts.hive_id) params = params.set('hive_id', opts.hive_id);
    return this.http.get<ServiceListResponse>(`${API_BASE}/services`, { params });
  }

  get(id: string): Observable<ServiceResponse> {
    return this.http.get<ServiceResponse>(`${API_BASE}/services/${id}`);
  }

  assignHive(id: string, hiveId: string | null): Observable<ServiceResponse> {
    return this.http.put<ServiceResponse>(`${API_BASE}/services/${id}/hive`, { hive_id: hiveId });
  }

  create(body: CreateServiceRequest): Observable<ServiceResponse> {
    return this.http.post<ServiceResponse>(`${API_BASE}/services`, body);
  }

  update(id: string, body: UpdateServiceRequest): Observable<ServiceResponse> {
    return this.http.put<ServiceResponse>(`${API_BASE}/services/${id}`, body);
  }

  setResources(id: string, body: ResourcesDTO): Observable<ServiceResponse> {
    return this.http.put<ServiceResponse>(`${API_BASE}/services/${id}/resources`, body);
  }

  setPlacement(id: string, body: PlacementDTO): Observable<ServiceResponse> {
    return this.http.put<ServiceResponse>(`${API_BASE}/services/${id}/placement`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/services/${id}`);
  }

  deploy(
    id: string,
    opts: { force?: boolean; repull?: boolean } = {},
  ): Observable<DeploymentResponse> {
    return this.http.post<DeploymentResponse>(`${API_BASE}/services/${id}/deploy`, {
      force: opts.force ?? false,
      repull: opts.repull ?? false,
    });
  }

  undeploy(id: string): Observable<ServiceResponse> {
    return this.http.post<ServiceResponse>(`${API_BASE}/services/${id}/undeploy`, {});
  }

  deployments(id: string): Observable<DeploymentListResponse> {
    return this.http.get<DeploymentListResponse>(`${API_BASE}/services/${id}/deployments`);
  }

  status(id: string): Observable<ServiceLiveStatus> {
    return this.http.get<ServiceLiveStatus>(`${API_BASE}/services/${id}/status`);
  }

  tasks(id: string): Observable<ServiceTasksResponse> {
    return this.http.get<ServiceTasksResponse>(`${API_BASE}/services/${id}/tasks`);
  }

  env(id: string): Observable<EnvVarsResponse> {
    return this.http.get<EnvVarsResponse>(`${API_BASE}/services/${id}/env`);
  }

  setEnv(id: string, body: SetEnvVarsRequest): Observable<EnvVarsResponse> {
    return this.http.put<EnvVarsResponse>(`${API_BASE}/services/${id}/env`, body);
  }

  networks(id: string): Observable<NetworkResponse[]> {
    return this.http.get<NetworkResponse[]>(`${API_BASE}/services/${id}/networks`);
  }

  attachNetwork(id: string, networkId: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/services/${id}/networks`, { network_id: networkId });
  }

  detachNetwork(id: string, networkId: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/services/${id}/networks/${networkId}`);
  }

  serviceSecrets(id: string): Observable<ServiceSecretResponse[]> {
    return this.http.get<ServiceSecretResponse[]>(`${API_BASE}/services/${id}/secrets`);
  }

  attachSecret(id: string, secretId: string, targetPath: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/services/${id}/secrets`, {
      secret_id: secretId,
      target_path: targetPath,
    });
  }

  detachSecret(id: string, secretId: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/services/${id}/secrets/${secretId}`);
  }

  serviceConfigs(id: string): Observable<ServiceConfigResponse[]> {
    return this.http.get<ServiceConfigResponse[]>(`${API_BASE}/services/${id}/configs`);
  }

  mounts(id: string): Observable<MountsResponse> {
    return this.http.get<MountsResponse>(`${API_BASE}/services/${id}/mounts`);
  }

  setMounts(id: string, body: SetMountsRequest): Observable<MountsResponse> {
    return this.http.put<MountsResponse>(`${API_BASE}/services/${id}/mounts`, body);
  }

  ports(id: string): Observable<PortsResponse> {
    return this.http.get<PortsResponse>(`${API_BASE}/services/${id}/ports`);
  }

  setPorts(id: string, body: SetPortsRequest): Observable<PortsResponse> {
    return this.http.put<PortsResponse>(`${API_BASE}/services/${id}/ports`, body);
  }

  attachConfig(id: string, configId: string, targetPath: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/services/${id}/configs`, {
      config_id: configId,
      target_path: targetPath,
    });
  }

  detachConfig(id: string, configId: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/services/${id}/configs/${configId}`);
  }

  snapshots(id: string, page = 1, size = 50): Observable<SnapshotListResponse> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<SnapshotListResponse>(`${API_BASE}/services/${id}/snapshots`, { params });
  }

  createSnapshot(id: string, body: CreateSnapshotRequest = {}): Observable<SnapshotResponse> {
    return this.http.post<SnapshotResponse>(`${API_BASE}/services/${id}/snapshots`, body);
  }
}

@Injectable({ providedIn: 'root' })
export class HivesApi {
  private readonly http = inject(HttpClient);

  list(page = 1, size = 100): Observable<HiveListResponse> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<HiveListResponse>(`${API_BASE}/hives`, { params });
  }

  get(id: string): Observable<HiveResponse> {
    return this.http.get<HiveResponse>(`${API_BASE}/hives/${id}`);
  }

  create(body: CreateHiveRequest): Observable<HiveResponse> {
    return this.http.post<HiveResponse>(`${API_BASE}/hives`, body);
  }

  update(id: string, body: UpdateHiveRequest): Observable<HiveResponse> {
    return this.http.put<HiveResponse>(`${API_BASE}/hives/${id}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/hives/${id}`);
  }

  services(id: string): Observable<ServiceResponse[]> {
    return this.http.get<ServiceResponse[]>(`${API_BASE}/hives/${id}/services`);
  }
}

@Injectable({ providedIn: 'root' })
export class NetworksApi {
  private readonly http = inject(HttpClient);

  list(page = 1, size = 50): Observable<NetworkListResponse> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<NetworkListResponse>(`${API_BASE}/networks`, { params });
  }

  get(id: string): Observable<NetworkResponse> {
    return this.http.get<NetworkResponse>(`${API_BASE}/networks/${id}`);
  }

  create(body: CreateNetworkRequest): Observable<NetworkResponse> {
    return this.http.post<NetworkResponse>(`${API_BASE}/networks`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/networks/${id}`);
  }

  swarm(): Observable<SwarmNetworkInfo[]> {
    return this.http.get<SwarmNetworkInfo[]>(`${API_BASE}/networks/swarm`);
  }
}

@Injectable({ providedIn: 'root' })
export class VolumesApi {
  private readonly http = inject(HttpClient);

  list(page = 1, size = 50): Observable<VolumeListResponse> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<VolumeListResponse>(`${API_BASE}/volumes`, { params });
  }

  create(body: CreateVolumeRequest): Observable<VolumeResponse> {
    return this.http.post<VolumeResponse>(`${API_BASE}/volumes`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/volumes/${id}`);
  }

  swarm(): Observable<SwarmVolumeInfo[]> {
    return this.http.get<SwarmVolumeInfo[]>(`${API_BASE}/volumes/swarm`);
  }
}

@Injectable({ providedIn: 'root' })
export class ConfigsApi {
  private readonly http = inject(HttpClient);

  list(page = 1, size = 50): Observable<ConfigListResponse> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ConfigListResponse>(`${API_BASE}/configs`, { params });
  }

  get(id: string): Observable<ConfigResponse> {
    return this.http.get<ConfigResponse>(`${API_BASE}/configs/${id}`);
  }

  create(body: CreateConfigRequest): Observable<ConfigResponse> {
    return this.http.post<ConfigResponse>(`${API_BASE}/configs`, body);
  }

  versions(id: string): Observable<ConfigVersionResponse[]> {
    return this.http.get<ConfigVersionResponse[]>(`${API_BASE}/configs/${id}/versions`);
  }

  addVersion(id: string, body: AddConfigVersionRequest): Observable<ConfigResponse> {
    return this.http.post<ConfigResponse>(`${API_BASE}/configs/${id}/versions`, body);
  }

  diff(id: string, from: number, to: number): Observable<ConfigDiffResponse> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<ConfigDiffResponse>(`${API_BASE}/configs/${id}/diff`, { params });
  }

  restore(id: string, version: number, comment: string): Observable<ConfigResponse> {
    return this.http.post<ConfigResponse>(`${API_BASE}/configs/${id}/versions/${version}/restore`, {
      comment,
    });
  }

  impactedServices(id: string): Observable<ImpactedService[]> {
    return this.http.get<ImpactedService[]>(`${API_BASE}/configs/${id}/services`);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/configs/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class SecretsApi {
  private readonly http = inject(HttpClient);

  list(page = 1, size = 50): Observable<SecretListResponse> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<SecretListResponse>(`${API_BASE}/secrets`, { params });
  }

  get(id: string): Observable<SecretResponse> {
    return this.http.get<SecretResponse>(`${API_BASE}/secrets/${id}`);
  }

  create(body: CreateSecretRequest): Observable<SecretResponse> {
    return this.http.post<SecretResponse>(`${API_BASE}/secrets`, body);
  }

  rotate(id: string, value: string): Observable<SecretResponse> {
    return this.http.post<SecretResponse>(`${API_BASE}/secrets/${id}/rotate`, { value });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/secrets/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class TemplatesApi {
  private readonly http = inject(HttpClient);

  list(page = 1, size = 50): Observable<TemplateListResponse> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<TemplateListResponse>(`${API_BASE}/templates`, { params });
  }

  get(id: string): Observable<TemplateResponse> {
    return this.http.get<TemplateResponse>(`${API_BASE}/templates/${id}`);
  }

  create(body: CreateTemplateRequest): Observable<TemplateResponse> {
    return this.http.post<TemplateResponse>(`${API_BASE}/templates`, body);
  }

  update(id: string, body: UpdateTemplateRequest): Observable<TemplateResponse> {
    return this.http.put<TemplateResponse>(`${API_BASE}/templates/${id}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/templates/${id}`);
  }

  instantiate(id: string, body: InstantiateTemplateRequest): Observable<ServiceResponse> {
    return this.http.post<ServiceResponse>(`${API_BASE}/services/from-template/${id}`, body);
  }
}

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);

  list(page = 1, size = 50): Observable<UserListResponse> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<UserListResponse>(`${API_BASE}/users`, { params });
  }

  create(body: CreateUserRequest): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${API_BASE}/users`, body);
  }

  update(id: string, body: UpdateUserRequest): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${API_BASE}/users/${id}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/users/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class ClusterApi {
  private readonly http = inject(HttpClient);

  /** Aggregated dashboard overview (default cluster node health + global counts). */
  overview(): Observable<ClusterOverview> {
    return this.http.get<ClusterOverview>(`${API_BASE}/cluster/overview`);
  }

  /** Dashboard overview scoped to a specific cluster's node health. */
  overviewFor(clusterId: string): Observable<ClusterOverview> {
    return this.http.get<ClusterOverview>(`${API_BASE}/clusters/${clusterId}/overview`);
  }

  list(page = 1, size = 100): Observable<ClusterListResponse> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ClusterListResponse>(`${API_BASE}/clusters`, { params });
  }

  get(id: string): Observable<ClusterResponse> {
    return this.http.get<ClusterResponse>(`${API_BASE}/clusters/${id}`);
  }

  create(body: CreateClusterRequest): Observable<ClusterResponse> {
    return this.http.post<ClusterResponse>(`${API_BASE}/clusters`, body);
  }

  update(id: string, body: UpdateClusterRequest): Observable<ClusterResponse> {
    return this.http.patch<ClusterResponse>(`${API_BASE}/clusters/${id}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/clusters/${id}`);
  }

  setDefault(id: string): Observable<ClusterResponse> {
    return this.http.put<ClusterResponse>(`${API_BASE}/clusters/${id}/default`, {});
  }

  /** Probe connectivity; returns the cluster with its refreshed status. */
  test(id: string): Observable<ClusterResponse> {
    return this.http.post<ClusterResponse>(`${API_BASE}/clusters/${id}/test`, {});
  }

  /** Switch the cluster to agent mode and issue a one-time enrollment token. */
  enroll(id: string): Observable<EnrollClusterResponse> {
    return this.http.post<EnrollClusterResponse>(`${API_BASE}/clusters/${id}/enroll`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class SnapshotsApi {
  private readonly http = inject(HttpClient);

  get(id: string): Observable<SnapshotResponse> {
    return this.http.get<SnapshotResponse>(`${API_BASE}/snapshots/${id}`);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/snapshots/${id}`);
  }

  rollback(id: string): Observable<RollbackResponse> {
    return this.http.post<RollbackResponse>(`${API_BASE}/snapshots/${id}/rollback`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class DeploymentsApi {
  private readonly http = inject(HttpClient);

  get(id: string): Observable<DeploymentResponse> {
    return this.http.get<DeploymentResponse>(`${API_BASE}/deployments/${id}`);
  }

  list(
    opts: {
      service_id?: string;
      status?: string;
      from?: string;
      to?: string;
      page?: number;
      size?: number;
    } = {},
  ): Observable<DeploymentListResponse> {
    let params = new HttpParams();
    if (opts.service_id) params = params.set('service_id', opts.service_id);
    if (opts.status) params = params.set('status', opts.status);
    if (opts.from) params = params.set('from', opts.from);
    if (opts.to) params = params.set('to', opts.to);
    if (opts.page) params = params.set('page', opts.page);
    if (opts.size) params = params.set('size', opts.size);
    return this.http.get<DeploymentListResponse>(`${API_BASE}/deployments`, { params });
  }
}
