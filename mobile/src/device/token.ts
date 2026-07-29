import * as SecureStore from 'expo-secure-store';

import { request } from '@/api/client';

const TOKEN_KEY = 'perfect-bloom.device-token';

let cached: string | null = null;

/**
 * The device's token for the identify/care proxy, registering on first need.
 *
 * Not a React context: nothing renders differently with or without it, and the
 * two callers are both already async. Screens never see it — if registration
 * fails the call rejects and surfaces through the usual ErrorText, same as any
 * other network failure.
 */
export async function deviceToken(): Promise<string> {
  if (cached) return cached;

  const stored = await SecureStore.getItemAsync(TOKEN_KEY);
  if (stored) {
    cached = stored;
    return stored;
  }

  const { token } = await request<{ token: string }>('/api/v1/devices', { method: 'POST' });
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  cached = token;
  return token;
}
