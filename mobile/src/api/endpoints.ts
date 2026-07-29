import { request } from './client';
import type { AuthResponse, IdentifyResponse, User } from './types';

export function signup(email: string, password: string, timezone: string) {
  return request<AuthResponse>('/api/v1/auth/signup', {
    method: 'POST',
    body: { email, password, timezone },
  });
}

export function login(email: string, password: string) {
  return request<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function logout(token: string) {
  return request<void>('/api/v1/auth/logout', { method: 'POST', token });
}

export function fetchMe(token: string) {
  return request<User>('/api/v1/me', { token });
}

export type PhotoToIdentify = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export function identify(token: string, photos: PhotoToIdentify[]) {
  const form = new FormData();
  photos.forEach((photo, index) => {
    // React Native's FormData takes this {uri, name, type} shape rather than a Blob.
    form.append('images', {
      uri: photo.uri,
      name: photo.fileName ?? `plant-${index}.jpg`,
      type: photo.mimeType ?? 'image/jpeg',
    } as unknown as Blob);
  });
  return request<IdentifyResponse>('/api/v1/identify', { method: 'POST', form, token });
}
