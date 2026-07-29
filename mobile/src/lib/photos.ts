import { Directory, File, Paths } from 'expo-file-system';

/**
 * Plant photos, kept out of the cache directory.
 *
 * ImagePicker hands back a URI under the cache directory, which the OS is free
 * to purge when storage runs low. A saved plant's photo has to outlive that, so
 * it is copied into the document directory — which is also what device backups
 * include.
 */
const PHOTOS = new Directory(Paths.document, 'plant-photos');

/** Copy a picked photo into permanent storage. Returns the URI to store. */
export async function persistPhoto(sourceUri: string): Promise<string> {
  PHOTOS.create({ intermediates: true, idempotent: true });

  // Only a local filename, so timestamp plus a random suffix is enough.
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const destination = new File(PHOTOS, name);
  await new File(sourceUri).copy(destination);

  return destination.uri;
}

/** Remove a stored photo. Missing is not an error — deletion must be idempotent. */
export function deletePhoto(uri: string): void {
  const file = new File(uri);
  if (file.exists) file.delete();
}
