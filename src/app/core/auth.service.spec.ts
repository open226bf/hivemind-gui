import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import { AuthService } from './auth.service';
import { API_BASE } from './config';

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
