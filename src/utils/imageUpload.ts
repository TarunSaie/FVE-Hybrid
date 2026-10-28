/**
 * Mobile Image Upload Utility (fve-mobile)
 *
 * Responsibilities:
 *  - validateMobileImage()   – checks MIME type and raw file size.
 *  - compressMobileImage()   – resize to 1600px + WebP/JPEG via expo-image-manipulator.
 *  - computeMobileFileHash() – SHA-256 fingerprint for duplicate detection.
 *  - uploadMemberPhoto()     – full pipeline: validate → compress → dedup → upload.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/api/supabase';

/** Max raw image upload size: 10 MB */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Accepted MIME types for member photos */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface MobileUploadResult {
  publicUrl: string;
  /** true if an existing copy was reused instead of re-uploading */
  reused: boolean;
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
 * Computes a hex SHA-256 hash from a Blob.
 * Used to detect duplicate files before uploading.
 */
async function computeHash(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Full pipeline for uploading a member profile photo to the `member-images` bucket:
 *  1. Compress / resize to 1600px WebP.
 *  2. Compute SHA-256 hash for duplicate detection.
 *  3. If a file with the same hash already exists → reuse it (no bytes charged).
 *  4. Otherwise upload the compressed blob.
 *  5. Optionally delete the old photo if it's being replaced.
 *
 * @param localUri    – local file URI from expo-image-picker / expo-camera
 * @param oldPhotoUrl – current public URL of the member's photo (for orphan cleanup)
 * @returns public URL of the uploaded / reused image
 */
export async function uploadMemberPhoto(
  localUri: string,
  oldPhotoUrl?: string | null
): Promise<MobileUploadResult> {
  // Step 1 – compress
  const { uri: compressedUri, mimeType, extension } = await compressMobileImage(localUri);

  // Step 2 – fetch blob and compute hash
  const response = await fetch(compressedUri);
  const blob = await response.blob();
  const hash = await computeHash(blob);

  const storagePath = `members/${hash}.${extension}`;

  // Step 3 – duplicate check
  const { data: existing } = await supabase.storage.from('member-images').list('members', {
    search: `${hash}.${extension}`,
  });

  if (existing && existing.length > 0) {
    // Reuse existing file — no storage consumed
    const { data: { publicUrl } } = supabase.storage.from('member-images').getPublicUrl(storagePath);
    return { publicUrl, reused: true };
  }

  // Step 4 – upload
  const { error } = await supabase.storage.from('member-images').upload(storagePath, blob, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: { publicUrl } } = supabase.storage.from('member-images').getPublicUrl(storagePath);

  // Step 5 – orphan cleanup: delete the previous photo if it's being replaced
  if (oldPhotoUrl && oldPhotoUrl !== publicUrl && oldPhotoUrl.includes('member-images')) {
    try {
      const oldPath = new URL(oldPhotoUrl).pathname.split('/member-images/')[1];
      if (oldPath) await supabase.storage.from('member-images').remove([oldPath]);
    } catch {
      // Non-fatal: continue even if old file deletion fails
    }
  }

  return { publicUrl, reused: false };
}
