import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

import * as api from '@/api/endpoints';
import type { User } from '@/api/types';

const TOKEN_KEY = 'perfect-bloom.auth-token';

type AuthState = {
  token: string | null;
  user: User | null;
  loading: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on launch, and verify it still works — a token can be
  // revoked or expired while the app was closed.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (stored) {
          const me = await api.fetchMe(stored);
          if (active) {
            setToken(stored);
            setUser(me);
          }
        }
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (nextToken: string, nextUser: User) => {
    await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const signOut = useCallback(async () => {
    const current = token;
    setToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    // Revoke server-side too, but a network failure must not trap the user
    // in a signed-in state locally.
    if (current) await api.logout(current).catch(() => undefined);
  }, [token]);

  const value = useMemo(
    () => ({ token, user, loading, signIn, signOut }),
    [token, user, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

/** Narrowed accessor for screens that are already behind the auth gate. */
export function useAuthToken(): string {
  const { token } = useAuth();
  if (!token) throw new Error('useAuthToken used outside a protected screen');
  return token;
}
