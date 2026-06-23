import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import { AuthService } from './auth.service';
import { API_BASE } from './config';
import { MeResponse } from './models';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function login(): void {
    service.login('a@b.c', 'pw').subscribe();
    http.expectOne(`${API_BASE}/auth/login`).flush({ access_token: 'acc', refresh_token: 'ref' });
  }

  it('stores both tokens on login', () => {
    login();
    expect(service.token()).toBe('acc');
    expect(localStorage.getItem('hivemind.token')).toBe('acc');
    expect(localStorage.getItem('hivemind.refresh')).toBe('ref');
    expect(service.isAuthenticated()).toBe(true);
  });

  it('clears everything on logout', () => {
    login();
    service.logout();
    expect(service.token()).toBeNull();
    expect(localStorage.getItem('hivemind.token')).toBeNull();
    expect(localStorage.getItem('hivemind.refresh')).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('refresh is single-flight: parallel calls share one request', () => {
    login();
    service.refresh().subscribe();
    service.refresh().subscribe();
    const reqs = http.match(`${API_BASE}/auth/refresh`);
    expect(reqs.length).toBe(1); // both callers share the in-flight request
    expect(reqs[0].request.body).toEqual({ refresh_token: 'ref' });
    reqs[0].flush({ access_token: 'acc2', refresh_token: 'ref2' });
    expect(service.token()).toBe('acc2');
  });

  it('refresh errors (no HTTP call) when there is no refresh token', () => {
    let errored = false;
    service.refresh().subscribe({ error: () => (errored = true) });
    http.expectNone(`${API_BASE}/auth/refresh`);
    expect(errored).toBe(true);
  });
});

describe('AuthService — ACL gating (ADR 0003)', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
  });

  function setUser(u: Partial<MeResponse>): void {
    service.user.set({
      id: '1',
      email: 'a@b.c',
      role: 'operator',
      is_admin: false,
      scopes: [],
      acl_enforced: false,
      ...u,
    });
  }

  it('shadow mode keeps pre-ACL behaviour (no lock-out)', () => {
    setUser({ role: 'operator', scopes: [], acl_enforced: false });
    expect(service.enforced()).toBe(false);
    // The cluster selector must NOT be filtered — every cluster stays visible.
    expect(service.reachableClusterIds()).toBeNull();
    // read for all, write for operators, manage for admins.
    expect(service.canReadCluster('c1')).toBe(true);
    expect(service.canWriteCluster('c1')).toBe(true);
    expect(service.canManageCluster('c1')).toBe(false);
    expect(service.canWriteService({ cluster_id: 'cX' })).toBe(true);
  });

  it('shadow mode: a viewer cannot write but is never hidden a cluster', () => {
    setUser({ role: 'viewer', scopes: [], acl_enforced: false });
    expect(service.reachableClusterIds()).toBeNull();
    expect(service.canReadCluster('c1')).toBe(true);
    expect(service.canWriteCluster('c1')).toBe(false);
  });

  it('enforced mode filters the selector and gates on the grant verb', () => {
    setUser({
      role: 'operator',
      acl_enforced: true,
      scopes: [{ type: 'cluster', id: 'c1', verb: 'write' }],
    });
    expect(service.reachableClusterIds()).toEqual(new Set(['c1']));
    expect(service.canWriteCluster('c1')).toBe(true);
    expect(service.canWriteCluster('c2')).toBe(false);
    expect(service.canManageCluster('c1')).toBe(false); // write < manage
    // A cluster grant cascades to its hives and services.
    expect(service.canWriteHive('c1', 'anyHive')).toBe(true);
    expect(service.canWriteService({ cluster_id: 'c1', hive_id: 'h9' })).toBe(true);
    expect(service.canWriteService({ cluster_id: 'c2' })).toBe(false);
  });

  it('enforced mode: a hive grant refines a read-only cluster', () => {
    setUser({
      role: 'operator',
      acl_enforced: true,
      scopes: [
        { type: 'cluster', id: 'c1', verb: 'read' },
        { type: 'hive', id: 'h1', verb: 'write' },
      ],
    });
    expect(service.canWriteHive('c1', 'h1')).toBe(true); // elevated by the hive grant
    expect(service.canWriteHive('c1', 'h2')).toBe(false); // only the cluster read cascades
    expect(service.canWriteService({ cluster_id: 'c1', hive_id: 'h1' })).toBe(true);
    expect(service.canWriteService({ cluster_id: 'c1', hive_id: 'h2' })).toBe(false);
  });

  it('admins bypass everything', () => {
    setUser({ role: 'admin', is_admin: true, acl_enforced: true, scopes: [] });
    expect(service.reachableClusterIds()).toBeNull();
    expect(service.canManageCluster('anything')).toBe(true);
    expect(service.canWriteService({ cluster_id: 'x', hive_id: 'y' })).toBe(true);
  });
});
