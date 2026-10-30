// Calls to the classes server (deploy/site/classes.js), the same way saving online calls its server:
// relative to the page, so fancyant.com/keypals/ and keypals.org both reach their own API.
export type ApiError = Error & { status: number; body: Record<string, unknown> };

export async function api<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`api${path}`, { credentials: 'same-origin', ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
  } catch {
    const e = new Error('No internet right now. Try again in a moment.') as ApiError;
    e.status = 0; e.body = {};
    throw e;
  }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error((body as { error?: string }).error || 'That did not work. Try again in a moment.') as ApiError;
    e.status = r.status; e.body = body as Record<string, unknown>;
    throw e;
  }
  return body as T;
}
export const send = <T = Record<string, unknown>>(path: string, method: string, body?: unknown) => api<T>(path, { method, body: JSON.stringify(body ?? {}) });
