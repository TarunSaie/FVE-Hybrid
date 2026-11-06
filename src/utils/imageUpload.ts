/**
 * Mobile Image Upload Utility (fve-mobile)
 *
 * Responsibilities:
 *  - validateMobileImage()   – checks MIME type and raw file size.
 *  - compressMobileImage()   – resize to 1600px + WebP/JPEG via expo-image-manipulator.
 *  - uploadMemberPhoto()     – full pipeline: validate → compress → upload.
 *  - removeMemberPhoto()     – removes a previously uploaded member image.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { File } from 'expo-file-system';
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
 * Normalises legacy database values that contain only a Storage object path.
 * New uploads always persist a public URL, but older member records may contain
 * `members/<file>` or `member-images/members/<file>` instead. Keeping this
 * conversion in one place lets every avatar and viewer load either format.
 */
export function resolveMemberPhotoUrl(photoUrl?: string | null): string | null {
  const value = photoUrl?.trim();
  if (!value) return null;

  // Do not rewrite complete remote or device URLs. A client-configured Supabase
  // origin is valid, and local URIs are useful while a form is still open.
  if (/^(https?:|file:|content:|ph:|blob:)/i.test(value)) return value;

  const bucketMarker = `${MEMBER_IMAGES_BUCKET}/`;
  const markerIndex = value.indexOf(bucketMarker);
  const storagePath = (markerIndex >= 0 ? value.slice(markerIndex + bucketMarker.length) : value)
    .replace(/^\/+/, '');

  if (!storagePath.startsWith(MEMBER_PHOTO_PATH_PREFIX)) return value;

  return supabase.storage.from(MEMBER_IMAGES_BUCKET).getPublicUrl(storagePath).data.publicUrl;
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

  // React Native's FormData/Blob implementation is incompatible with
  // @supabase/storage-js. Its own React Native guidance requires an ArrayBuffer.
  // Expo File reads the manipulated local URI natively without a web-style upload
  // wrapper, avoiding StorageUnknownError: Unsupported FormDataPart implementation.
  const imageFile = new File(compressedUri);
  const imageBytes = await imageFile.arrayBuffer();
  if (imageBytes.byteLength === 0) {
    throw new Error('The processed image is empty. Please choose a different photo.');
  }

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

/**
 * Extracts an owned member-photo path from a Supabase public or signed URL.
 * Only objects under `members/` can be removed through this helper.
 */
function getMemberPhotoPath(photoUrl: string): string | null {
  try {
    const pathname = new URL(photoUrl).pathname;
    const marker = `/${MEMBER_IMAGES_BUCKET}/`;
    const bucketIndex = pathname.indexOf(marker);
    if (bucketIndex < 0) return null;

    const path = decodeURIComponent(pathname.slice(bucketIndex + marker.length));
    return path.startsWith(MEMBER_PHOTO_PATH_PREFIX) ? path : null;
  } catch {
    return null;
  }
}

/** Removes a member image from storage after its database reference is cleared. */
export async function removeMemberPhoto(photoUrl?: string | null): Promise<void> {
  if (!photoUrl) return;

  const storagePath = getMemberPhotoPath(photoUrl);
  if (!storagePath) return;

  const { error } = await supabase.storage.from(MEMBER_IMAGES_BUCKET).remove([storagePath]);
  if (error) {
    throw new Error(`Photo cleanup failed: ${error.message}`);
  }
}
