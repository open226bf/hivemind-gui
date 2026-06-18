import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { API_BASE } from './config';

describe('authInterceptor', () => {
  let http: HttpClient;
  let mock: HttpTestingController;
  let auth: AuthService;
  const navigate = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate } },
      ],
    });
    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    navigate.mockClear();

    // Seed an authenticated session (access + refresh token).
    auth.login('a@b.c', 'pw').subscribe();
    mock.expectOne(`${API_BASE}/auth/login`).flush({ access_token: 'acc', refresh_token: 'ref' });
  });

  afterEach(() => mock.verify());

  it('attaches the bearer token', () => {
    http.get('/api/v1/services').subscribe();
    const req = mock.expectOne('/api/v1/services');
    expect(req.request.headers.get('Authorization')).toBe('Bearer acc');
    req.flush([]);
  });

  it('refreshes and replays the request on 401', () => {
    let body: unknown;
    http.get('/api/v1/services').subscribe((r) => (body = r));

    mock.expectOne('/api/v1/services').flush(null, { status: 401, statusText: 'Unauthorized' });

    const refresh = mock.expectOne(`${API_BASE}/auth/refresh`);
    refresh.flush({ access_token: 'acc2', refresh_token: 'ref2' });

    const retried = mock.expectOne('/api/v1/services');
    expect(retried.request.headers.get('Authorization')).toBe('Bearer acc2');
    retried.flush([{ ok: true }]);

    expect(body).toEqual([{ ok: true }]);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('logs out and redirects when the refresh itself fails', () => {
    http.get('/api/v1/services').subscribe({ error: () => undefined });
    mock.expectOne('/api/v1/services').flush(null, { status: 401, statusText: 'Unauthorized' });
    mock
      .expectOne(`${API_BASE}/auth/refresh`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.token()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
