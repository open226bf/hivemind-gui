import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';

import { API_BASE } from './config';
import { ServiceLiveStatus, TaskState } from './models';

/** One live-state frame pushed by the SSE status stream. */
export interface ServiceStateUpdate {
  status: ServiceLiveStatus;
  tasks: TaskState[];
}

/**
 * Streams a service's live state over Server-Sent Events for a reactive UI
 * without per-second polling.
 *
 * SSE is used rather than WebSocket because it is plain HTTP: it survives a
 * reverse proxy (HAProxy, nginx) on the path with no Upgrade handshake. The
 * stream is authenticated with a single-use ticket (EventSource cannot send an
 * Authorization header). The observable errors when the stream cannot be
 * established or drops — the caller is expected to fall back to polling, which
 * keeps the UI working even where SSE is blocked.
 */
@Injectable({ providedIn: 'root' })
export class StatusStreamService {
  private readonly http = inject(HttpClient);

  stream(serviceId: string): Observable<ServiceStateUpdate> {
    return this.http
      .post<{ ticket: string }>(`${API_BASE}/services/${serviceId}/status/stream-ticket`, {})
      .pipe(switchMap((res) => this.sse(serviceId, res.ticket)));
  }

  private sse(serviceId: string, ticket: string): Observable<ServiceStateUpdate> {
    return new Observable<ServiceStateUpdate>((subscriber) => {
      const url = `${API_BASE}/services/${serviceId}/status/stream?ticket=${encodeURIComponent(ticket)}`;
      const es = new EventSource(url);

      es.addEventListener('status', (e) => {
        try {
          subscriber.next(JSON.parse((e as MessageEvent).data) as ServiceStateUpdate);
        } catch {
          /* ignore a malformed frame */
        }
      });

      es.onerror = () => {
        // EventSource auto-reconnects on transient drops (readyState CONNECTING).
        // CLOSED means the connection is dead (e.g. the single-use ticket can no
        // longer be redeemed, or a proxy refused the stream) — surface it so the
        // caller falls back to polling.
        if (es.readyState === EventSource.CLOSED) {
          subscriber.error(new Error('status stream closed'));
        }
      };

      return () => es.close();
    });
  }
}
