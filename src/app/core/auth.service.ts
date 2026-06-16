import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { API_BASE } from './config';
import { MeResponse, TokenResponse } from './models';

const TOKEN_KEY = 'hivemind.token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly user = signal<MeResponse | null>(null);
  readonly isAuthenticated = computed(() => this.token() !== null);

  readonly role = computed(() => this.user()?.role ?? null);
  readonly isAdmin = computed(() => this.role() === 'admin');
  /** Operator or Admin: may create/deploy/manage services, env, configs. */
  readonly isOperator = computed(() => this.role() === 'admin' || this.role() === 'operator');

  login(email: string, password: string): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${API_BASE}/auth/login`, { email, password })
      .pipe(tap((res) => this.setToken(res.access_token)));
  }

  loadMe(): Observable<MeResponse> {
    return this.http
      .get<MeResponse>(`${API_BASE}/auth/me`)
      .pipe(tap((u) => this.user.set(u)));
  }

  logout(): void {
    this.token.set(null);
    this.user.set(null);
    localStorage.removeItem(TOKEN_KEY);
  }

  private setToken(token: string): void {
    this.token.set(token);
    localStorage.setItem(TOKEN_KEY, token);
  }
}
