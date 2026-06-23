// Base path for the Hivemind API, derived from the document <base href> so it
// follows a sub-path deployment automatically. Behind a reverse proxy that
// serves the app under e.g. /hivemind/ (the backend injects
// <base href="/hivemind/">), the browser emits /hivemind/api/v1/… and the proxy
// strips the prefix before the backend, which is mounted at the root. In dev the
// base href is "/" so this stays "/api/v1" (proxied to the Go backend by
// proxy.conf.json).
const basePath = new URL(document.baseURI).pathname.replace(/\/$/, '');
export const API_BASE = `${basePath}/api/v1`;
