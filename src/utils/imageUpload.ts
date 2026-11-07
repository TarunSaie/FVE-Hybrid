/**
 * Mobile Image Upload Utility (fve-mobile)
 *
 * Responsibilities:
 *  - validateMobileImage()   – checks MIME type and raw file size.
 *  - compressMobileImage()   – resize to 1600px + WebP/JPEG via expo-image-manipulator.
 *  - uploadMemberPhoto()     – full pipeline: validate → compress → upload.
 *  - removeMemberPhoto()     – removes a previously uploaded member image.
 *
 * Upload strategy:
 *  React Native's Blob/FormData implementations are incompatible with
 *  @supabase/storage-js. The workaround is to read the compressed file as a
 *  base64 string via expo-file-system and decode it into an ArrayBuffer via
 *  base64-arraybuffer before handing it to supabase.storage.upload().
 *  This avoids "StorageUnknownError: Unsupported FormDataPart implementation".
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/api/supabase';

/** Max raw image upload size: 10 MB */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MEMBER_IMAGES_BUCKET = 'member-images';
const MEMBER_PHOTO_PATH_PREFIX = 'members/';

/** Accepted MIME types for member photos */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface MobileUploadResult {
  publicUrl: string;
  /** true if an existing copy was reused instead of re-uploading */
  reused: boolean;
}

/**
 * Extracts a member photo object path from a Supabase URL or a legacy path.
 * Signed URL tokens are deliberately ignored; they expire and must never be
 * treated as the durable photo reference.
 */
function getMemberPhotoPath(photoUrl?: string | null): string | null {
  const value = photoUrl?.trim();
  if (!value) return null;

  let candidate = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      const pathname = new URL(value).pathname;
      const objectRoute = '/storage/v1/object/';
      const routeIndex = pathname.indexOf(objectRoute);
      if (routeIndex < 0) return null;

      const route = pathname.slice(routeIndex + objectRoute.length);
      const match = route.match(/^(?:public|sign|authenticated)\/member-images\/(.+)$/);
      if (!match) return null;
      candidate = match[1];
    } catch {
      return null;
    }
  } else {
    const bucketMarker = `${MEMBER_IMAGES_BUCKET}/`;
    const markerIndex = value.indexOf(bucketMarker);
    candidate = markerIndex >= 0 ? value.slice(markerIndex + bucketMarker.length) : value;
  }

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    // Keep the original path if it contains a literal percent sign.
  }

  const storagePath = candidate.replace(/^\/+/, '');
  return storagePath.startsWith(MEMBER_PHOTO_PATH_PREFIX) ? storagePath : null;
}

/**
 * Normalises legacy object paths and signed URLs to a durable public URL.
 * New uploads persist public URLs; older records may contain `members/<file>`,
 * `member-images/members/<file>`, or an expiring signed URL.
 */
export function resolveMemberPhotoUrl(photoUrl?: string | null): string | null {
  const value = photoUrl?.trim();
  if (!value) return null;

  // Use a durable public URL for known member-images objects. This strips an
  // expired signed token from legacy database values and gives native image
  // caches one stable URL. Keep local and unrelated remote URLs untouched.
  const storagePath = getMemberPhotoPath(value);
  if (storagePath) {
    return supabase.storage.from(MEMBER_IMAGES_BUCKET).getPublicUrl(storagePath).data.publicUrl;
  }

  return value;
}

/** Creates a short-lived read URL for fallback when public image access fails. */
export async function createMemberPhotoSignedUrl(
  photoUrl: string,
  expiresInSeconds = 60 * 60
): Promise<string | null> {
  const storagePath = getMemberPhotoPath(photoUrl);
  if (!storagePath) return null;

  const { data, error } = await supabase.storage
    .from(MEMBER_IMAGES_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data?.signedUrl || null;
}

/**
 * Validates an image URI before upload.
 * `mimeType` comes from expo-image-picker's asset.mimeType.
 * Returns an error string on failure, null on success.
 */
export function validateMobileImage(mimeType?: string, fileSize?: number): string | null {
  if (mimeType && !ALLOWED_TYPES.includes(mimeType)) {
    return `Unsupported file type "${mimeType}". Please select a JPEG, PNG, or WebP image.`;
  }
  if (fileSize && fileSize > MAX_IMAGE_BYTES) {
    return `Image is too large (${(fileSize / 1024 / 1024).toFixed(1)} MB). Maximum allowed is 10 MB.`;
  }
  return null;
}

/**
 * Compresses a local image URI to max 1600×1600 px, preferring WebP.
 * Returns the compressed local URI and MIME type.
 */
export async function compressMobileImage(uri: string): Promise<{
  uri: string;
  mimeType: 'image/webp' | 'image/jpeg';
  extension: 'webp' | 'jpg';
}> {
  // Resize to max 1600px on the longest edge while maintaining aspect ratio
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    {
      compress: 0.82,
      format: ImageManipulator.SaveFormat.WEBP,
    }
  );

  return { uri: result.uri, mimeType: 'image/webp', extension: 'webp' };
}

/**
 * Full pipeline for uploading a member profile photo to the `member-images` bucket:
 *  1. Compress / resize to 1600px WebP.
 *  2. Generate unique filename.
 *  3. Upload an ArrayBuffer to Supabase Storage.
 *
 * @param localUri    – local file URI from expo-image-picker / expo-camera
 * @returns public URL of the uploaded image
 */
export async function uploadMemberPhoto(localUri: string): Promise<MobileUploadResult> {
  // Step 1 – compress
  const { uri: compressedUri, mimeType, extension } = await compressMobileImage(localUri);

  // Step 2 – unique filename
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const fileName = `${timestamp}_${randomSuffix}.${extension}`;
  const storagePath = `${MEMBER_PHOTO_PATH_PREFIX}${fileName}`;

  // React Native's Blob/FormData implementations are incompatible with
  // @supabase/storage-js. Reading as base64 via expo-file-system and decoding
  // with base64-arraybuffer is the proven workaround for Android and iOS.
  const base64 = await FileSystem.readAsStringAsync(compressedUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!base64 || base64.length === 0) {
    throw new Error('The processed image is empty. Please choose a different photo.');
  }
  const imageBytes = decode(base64);

  const { error } = await supabase.storage.from(MEMBER_IMAGES_BUCKET).upload(storagePath, imageBytes, {
    contentType: mimeType,
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    console.error('[uploadMemberPhoto] Storage upload failed:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage.from(MEMBER_IMAGES_BUCKET).getPublicUrl(storagePath);

  return { publicUrl, reused: false };
}

/** Removes a member image from storage after its database reference is cleared. */
export async function removeMemberPhoto(photoUrl?: string | null): Promise<void> {
  if (!photoUrl) return;

  const storagePath = getMemberPhotoPath(photoUrl);
  if (!storagePath) return;

  const { error } = await supabase.storage.from(MEMBER_IMAGES_BUCKET).remove([storagePath]);
  if (error && !isMissingStorageObjectError(error)) {
    throw new Error(`Photo cleanup failed: ${error.message}`);
  }
}

function isMissingStorageObjectError(error: { message?: string; statusCode?: string | number }): boolean {
  if (String(error.statusCode) === '404') return true;
  return /(?:object|file)\s+not\s+found|not\s+found\s+(?:object|file)/i.test(error.message || '');
}
