import { File } from 'expo-file-system';

import { deviceToken } from '@/device/token';
import { request } from './client';
import type { CareInfo, IdentifyResponse } from './types';

/**
 * The only two things that still cross the network. Both fetch the device token
 * themselves, so no screen has to carry one around.
 */
export async function identify(uris: string[]) {
  const form = new FormData();
  // Expo's fetch serializes FormData in JS and only accepts Blob parts, so each
  // photo goes in as a File. The legacy {uri, name, type} shape throws.
  uris.forEach((uri) => form.append('images', new File(uri)));
  return request<IdentifyResponse>('/api/v1/identify', {
    method: 'POST',
    form,
    token: await deviceToken(),
  });
}

export async function fetchCare(scientificName: string) {
  const query = encodeURIComponent(scientificName);
  return request<CareInfo>(`/api/v1/care?scientific_name=${query}`, {
    token: await deviceToken(),
  });
}
