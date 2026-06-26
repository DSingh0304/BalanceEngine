import { useState, useCallback } from 'react';
import api from '../api/index.js';
import type { User } from '../types/index.js';

const TOKEN_KEY = 'BalanceEngine_token';
const USER_KEY = 'BalanceEngine_user';

const loadUser = (): User | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
};

const extractErrorMessage = (err: unknown, fallback: string): string => {
  if (
    err !== null &&
    typeof err === 'object' &&
    'response' in err &&
    err.response !== null &&
    typeof err.response === 'object' &&
    'data' in err.response &&
    err.response.data !== null &&
    typeof err.response.data === 'object' &&
    'error' in err.response.data &&
    typeof (err.response.data as Record<string, unknown>).error === 'string'
  ) {
    return (err.response.data as { error: string }).error;
  }
  return fallback;
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(loadUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      const { user: u, token } = data.data as { user: User; token: string };
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      setUser(u);
      return u;
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Login failed');
      setError(msg);
      throw new Error(msg, { cause: err });
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/api/auth/register', { name, email, password });
      const { user: u, token } = data.data as { user: User; token: string };
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      setUser(u);
      return u;
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Registration failed');
      setError(msg);
      throw new Error(msg, { cause: err });
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  return { user, loading, error, login, register, logout };
};
