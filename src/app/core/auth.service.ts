import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize, Observable, shareReplay, tap, throwError } from 'rxjs';

import { API_BASE } from './config';
import { MeResponse, Scope, TokenResponse, Verb } from './models';

const TOKEN_KEY = 'hivemind.token';
const REFRESH_KEY = 'hivemind.refresh';

const VERB_RANK: Record<Verb, number> = { read: 1, write: 2, manage: 3 };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly user = signal<MeResponse | null>(null);
  readonly isAuthenticated = computed(() => this.token() !== null);

  readonly role = computed(() => this.user()?.role ?? null);
  readonly isAdmin = computed(() => this.user()?.is_admin ?? this.role() === 'admin');
  /** Operator or Admin: may create/deploy/manage services, env, configs. */
  readonly isOperator = computed(() => this.role() === 'admin' || this.role() === 'operator');

  /** Effective ACL grants from /auth/me (empty for admins, who bypass). */
  readonly scopes = computed<Scope[]>(() => this.user()?.scopes ?? []);

  /**
   * Effective verb on a resource, applying the cluster→hive cascade (ADR 0003):
   * the highest of the matching cluster grant and the matching hive grant.
   * Admins always resolve to 'manage'. Returns null when no access.
   */
  effectiveVerb(clusterId: string | null | undefined, hiveId?: string | null): Verb | null {
    if (this.isAdmin()) return 'manage';
    let best: Verb | null = null;
    for (const s of this.scopes()) {
      const match =
        (s.type === 'cluster' && clusterId && s.id === clusterId) ||
        (s.type === 'hive' && hiveId && s.id === hiveId);
      if (match && (best === null || VERB_RANK[s.verb] > VERB_RANK[best])) {
        best = s.verb;
      }
    }
    return best;
  }

  private atLeast(verb: Verb | null, min: Verb): boolean {
    return verb !== null && VERB_RANK[verb] >= VERB_RANK[min];
  }

  /** Per-hive gates (cluster grants cascade down). */
  canReadHive(clusterId: string | null | undefined, hiveId: string): boolean {
    return this.atLeast(this.effectiveVerb(clusterId, hiveId), 'read');
  }
  canWriteHive(clusterId: string | null | undefined, hiveId: string): boolean {
    return this.atLeast(this.effectiveVerb(clusterId, hiveId), 'write');
  }
  canManageHive(clusterId: string | null | undefined, hiveId: string): boolean {
    return this.atLeast(this.effectiveVerb(clusterId, hiveId), 'manage');
  }

  /** Per-cluster gates. */
  canReadCluster(clusterId: string): boolean {
    return this.atLeast(this.effectiveVerb(clusterId, null), 'read');
  }
  canWriteCluster(clusterId: string): boolean {
    return this.atLeast(this.effectiveVerb(clusterId, null), 'write');
  }
  canManageCluster(clusterId: string): boolean {
    return this.atLeast(this.effectiveVerb(clusterId, null), 'manage');
  }

  /** Clusters the user can reach: those granted directly (admin = unbounded,
   *  signalled by null). Used to filter the cluster selector. */
  readonly reachableClusterIds = computed<Set<string> | null>(() => {
    if (this.isAdmin()) return null; // null = no restriction
    const ids = new Set<string>();
    for (const s of this.scopes()) {
      if (s.type === 'cluster') ids.add(s.id);
    }
    return ids;
  });

  private refreshToken = localStorage.getItem(REFRESH_KEY);
  /** In-flight refresh, shared so concurrent 401s trigger a single call. */
  private refresh$: Observable<TokenResponse> | null = null;

  login(email: string, password: string): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${API_BASE}/auth/login`, { email, password })
      .pipe(tap((res) => this.setTokens(res)));
  }

  loadMe(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${API_BASE}/auth/me`).pipe(tap((u) => this.user.set(u)));
  }

  /**
   * Exchanges the stored refresh token for a fresh token pair. The access token
   * lives ~15 min, so this keeps a session alive without forcing re-login. The
   * call is single-flight: parallel 401s share one request.
   */
  refresh(): Observable<TokenResponse> {
    if (this.refresh$) {
      return this.refresh$;
    }
    if (!this.refreshToken) {
      return throwError(() => new Error('no refresh token'));
    }
    this.refresh$ = this.http
      .post<TokenResponse>(`${API_BASE}/auth/refresh`, { refresh_token: this.refreshToken })
      .pipe(
        tap((res) => this.setTokens(res)),
        finalize(() => (this.refresh$ = null)),
        shareReplay(1),
      );
    return this.refresh$;
  }

  logout(): void {
    this.token.set(null);
    this.user.set(null);
    this.refreshToken = null;
    this.refresh$ = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }

  private setTokens(res: TokenResponse): void {
    this.token.set(res.access_token);
    localStorage.setItem(TOKEN_KEY, res.access_token);
    if (res.refresh_token) {
      this.refreshToken = res.refresh_token;
      localStorage.setItem(REFRESH_KEY, res.refresh_token);
    }
  }
}
