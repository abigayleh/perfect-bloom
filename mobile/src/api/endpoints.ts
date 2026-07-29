import { File } from 'expo-file-system';

import { request } from './client';
import type { AuthResponse, CareInfo, IdentifyResponse, Plant, User, Watering } from './types';

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

export function updateTimezone(token: string, timezone: string) {
  return request<User>('/api/v1/me', { method: 'PATCH', body: { timezone }, token });
}

export function identify(token: string, uris: string[]) {
  const form = new FormData();
  // Expo's fetch serializes FormData in JS and only accepts Blob parts, so each
  // photo goes in as a File. The legacy {uri, name, type} shape throws.
  uris.forEach((uri) => form.append('images', new File(uri)));
  return request<IdentifyResponse>('/api/v1/identify', { method: 'POST', form, token });
}

export function fetchCare(token: string, scientificName: string) {
  const query = encodeURIComponent(scientificName);
  return request<CareInfo>(`/api/v1/care?scientific_name=${query}`, { token });
}

export type PlantInput = {
  scientific_name?: string;
  nickname?: string | null;
  common_name?: string | null;
  image_key?: string | null;
  interval_days?: number | null;
};

export function fetchPlants(token: string) {
  return request<Plant[]>('/api/v1/plants', { token });
}

export function fetchPlant(token: string, id: number) {
  return request<Plant>(`/api/v1/plants/${id}`, { token });
}

export function createPlant(token: string, body: PlantInput) {
  return request<Plant>('/api/v1/plants', { method: 'POST', body, token });
}

export function updatePlant(
  token: string,
  id: number,
  body: { nickname?: string; interval_days?: number | null; clear_interval?: boolean },
) {
  return request<Plant>(`/api/v1/plants/${id}`, { method: 'PATCH', body, token });
}

export function deletePlant(token: string, id: number) {
  return request<void>(`/api/v1/plants/${id}`, { method: 'DELETE', token });
}

/** Returns the plant with its re-anchored schedule. */
export function waterPlant(token: string, id: number, wateredAt?: string) {
  return request<Plant>(`/api/v1/plants/${id}/waterings`, {
    method: 'POST',
    body: wateredAt ? { watered_at: wateredAt } : {},
    token,
  });
}

export function fetchWaterings(token: string, id: number) {
  return request<Watering[]>(`/api/v1/plants/${id}/waterings`, { token });
}
