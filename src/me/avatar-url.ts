import { Logger } from '@nestjs/common';
import { extname } from 'node:path';
import type { StorageService } from '../storage/storage.service.js';
import { AVATAR_LIMITS } from '../types/profile.contract.js';

/** Signed avatar links live this long; clients fetch the profile again for a fresh one. */
export const AVATAR_URL_TTL_SEC = 3600;

const logger = new Logger('Avatar');

/** UserProfile.avatarUrl holds a storage key; older rows may hold a full external URL. */
export const isExternalUrl = (value: string) => /^https?:\/\//i.test(value);

/**
 * The link to show for UserProfile.avatarUrl: a signed URL for an uploaded picture, the value
 * itself for an external URL, null when there is none or the link cannot be made.
 */
export async function avatarUrlFor(storage: StorageService, value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (isExternalUrl(value)) return value;
  const ext = extname(value).toLowerCase();
  try {
    return await storage.getDownloadUrl(value, {
      fileName: `avatar${ext}`,
      contentType: AVATAR_LIMITS.allowedTypes[ext] ?? 'application/octet-stream',
      expiresInSec: AVATAR_URL_TTL_SEC,
    });
  } catch (error) {
    // A missing picture must never break the profile, Home or the users list.
    logger.error(JSON.stringify({ event: 'avatar.url_failed', key: value, error: String(error) }));
    return null;
  }
}
