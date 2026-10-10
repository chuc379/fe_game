import { SOCKET_URL } from '@/lib/socket';

const TOKEN_KEY = 'mc_token';

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = (): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
};

export const login = async (
  username: string,
  password: string
): Promise<{ token?: string; error?: string }> => {
  try {
    const res = await fetch(`${SOCKET_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.success || !data?.token) {
      return { error: data?.error || 'Login failed' };
    }

    return { token: data.token };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' };
  }
};
