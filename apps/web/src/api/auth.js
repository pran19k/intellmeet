export const API_BASE = import.meta.env.VITE_API_BASE;

if (!API_BASE) {
  throw new Error('VITE_API_BASE is required. Create apps/web/.env from apps/web/.env.example.');
}

async function request(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw data || { error: { message: 'Network error' } };
  return data;
}

export async function signup(payload) {
  return request('/api/auth/signup', payload);
}

export async function login(payload) {
  return request('/api/auth/login', payload);
}

export async function refresh(refreshToken) {
  return request('/api/auth/refresh', { refreshToken });
}

export const tokenStore = {
  set(tokens) {
    if (tokens.accessToken) localStorage.setItem('accessToken', tokens.accessToken);
    if (tokens.refreshToken) localStorage.setItem('refreshToken', tokens.refreshToken);
  },
  getAccess() {
    return localStorage.getItem('accessToken');
  },
  clear() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};
