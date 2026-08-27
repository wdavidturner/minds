export const WORKER_NAME = "minds";

export function workerDashboardUrl(): string {
  return `https://dash.cloudflare.com/?to=/:account/workers/services/view/${WORKER_NAME}`;
}

export function workerObservabilityUrl(slug: string): string {
  return `https://dash.cloudflare.com/?to=/:account/workers/services/view/${WORKER_NAME}/production/observability#${encodeURIComponent(slug)}`;
}
