export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).detail ?? msg;
    } catch {}
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<void>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => apiFetch<void>('/api/auth/logout', { method: 'POST' }),
  me: () => apiFetch<import('./schema').UserOut>('/api/auth/me'),
  signals: (limit = 100, beforeId?: string) => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (beforeId) q.set('before_id', beforeId);
    return apiFetch<import('./schema').SignalsPage>(`/api/signals?${q}`);
  },
  sourceHealth: () =>
    apiFetch<import('./schema').SourceHealthResponse>('/api/sources/health'),
};
