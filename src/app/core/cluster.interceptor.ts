import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { ClusterContextService } from './cluster-context.service';

/**
 * Attaches the active cluster to every API call as the X-Hivemind-Cluster
 * header. The backend reads it once per request and scopes both reads (lists)
 * and writes (creates) to that cluster — so resources always land in, and are
 * read from, the cluster selected in the sidebar without per-request plumbing
 * or a cluster picker on each form.
 *
 * When no cluster is selected (the aggregated "all" view) the header is omitted
 * and the backend falls back to its default behaviour.
 */
export const clusterInterceptor: HttpInterceptorFn = (req, next) => {
  const ctx = inject(ClusterContextService);
  const clusterId = ctx.selectedId();
  if (!clusterId) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-Hivemind-Cluster': clusterId } }));
};
