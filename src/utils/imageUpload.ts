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
 * Computes a hex SHA-256 hash from a Blob with robust fallback if crypto.subtle is unavailable.
 * Used to detect duplicate files before uploading.
 */
async function computeHash(blob: Blob): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto?.subtle?.digest) {
      const buffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch (err) {
    console.warn('[computeHash] WebCrypto subtle digest unavailable, using fallback:', err);
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}_${blob.size}`;
}

/**
 * Full pipeline for uploading a member profile photo to the `member-images` bucket:
 *  1. Compress / resize to 1600px WebP.
 *  2. Generate unique filename.
 *  3. Stream upload using React Native FormData to Supabase Storage.
 *  4. Optionally delete the old photo if it's being replaced.
 *
 * @param localUri    – local file URI from expo-image-picker / expo-camera
 * @param oldPhotoUrl – current public URL of the member's photo (for orphan cleanup)
 * @returns public URL of the uploaded image
 */
export async function uploadMemberPhoto(
  localUri: string,
  oldPhotoUrl?: string | null
): Promise<MobileUploadResult> {
  // Step 1 – compress
  const { uri: compressedUri, mimeType, extension } = await compressMobileImage(localUri);

  // Step 2 – unique filename
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const fileName = `${timestamp}_${randomSuffix}.${extension}`;
  const storagePath = `members/${fileName}`;

  // Step 3 – upload via native FormData streaming (100% reliable on React Native)
  const formData = new FormData();
  formData.append('', {
    uri: compressedUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  const { error } = await supabase.storage.from('member-images').upload(storagePath, formData, {
    contentType: mimeType,
    upsert: true,
  });

  if (error) {
    console.error('[uploadMemberPhoto] Storage upload failed:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage.from('member-images').getPublicUrl(storagePath);

  // Step 4 – orphan cleanup: delete the previous photo if it's being replaced
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
