import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import { extname } from 'node:path';
import { ApiException } from './api-errors.js';

/** Content types browsers and phones really send for the allowed extensions. */
const DECLARED_MIME_ALIASES: Record<string, readonly string[]> = {
  '.zip': ['application/x-zip-compressed', 'application/x-zip'],
  '.jpg': ['image/pjpeg', 'image/jpg'],
  '.jpeg': ['image/pjpeg', 'image/jpg'],
};

/** What `file-type` reports for each extension. `.txt` has no signature. */
const MAGIC_EXT: Record<string, string> = {
  '.pdf': 'pdf',
  // Word 97-2003 files are OLE compound files; file-type reports the container type.
  '.doc': 'cfb',
  '.docx': 'docx',
  '.pptx': 'pptx',
  '.xlsx': 'xlsx',
  '.png': 'png',
  '.jpg': 'jpg',
  '.jpeg': 'jpg',
  '.webp': 'webp',
  '.zip': 'zip',
};

export type InspectedFile = {
  /** Lowercase extension with the dot, used in the storage key. */
  ext: string;
  /** Canonical MIME type for the extension (never the client's value). */
  mimeType: string;
  /** Original name, sanitized for display and download. */
  fileName: string;
};

const unsupported = (message = 'File type is not supported.') =>
  new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'UNSUPPORTED_FILE_TYPE', message);

/**
 * Display name: no path, no control or bidi-override characters, at most 200
 * characters, extension kept. Arabic is allowed.
 */
export function sanitizeFileName(originalName: string, ext: string): string {
  const base = originalName.split(/[\\/]/).pop() ?? '';
  const clean = base
    .replace(/[\p{Cc}‎‏‪-‮⁦-⁩]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const name = clean || `file${ext}`;
  if (name.length <= 200) return name;
  const keepExt = name.toLowerCase().endsWith(ext) ? ext : '';
  return name.slice(0, 200 - keepExt.length) + keepExt;
}

function isPlainText(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks extension, declared MIME type and the real type from the magic bytes
 * against `allowedTypes` (extension with dot -> canonical MIME type).
 * Throws 415 UNSUPPORTED_FILE_TYPE on any mismatch.
 */
export async function inspectUpload(
  file: Express.Multer.File,
  allowedTypes: Readonly<Record<string, string>>,
): Promise<InspectedFile> {
  const ext = extname(file.originalname).toLowerCase();
  const mimeType = allowedTypes[ext];
  if (!mimeType) throw unsupported();

  // Browsers fall back to octet-stream for types the OS does not know; the magic
  // bytes check below is what decides.
  const declared = file.mimetype.toLowerCase();
  const declaredOk =
    declared === mimeType ||
    declared === 'application/octet-stream' ||
    (DECLARED_MIME_ALIASES[ext] ?? []).includes(declared);
  if (!declaredOk) throw unsupported();

  const detected = await fileTypeFromBuffer(file.buffer);
  const contentOk = ext === '.txt' ? !detected && isPlainText(file.buffer) : detected?.ext === MAGIC_EXT[ext];
  if (!contentOk) throw unsupported('File content does not match its type.');

  return { ext, mimeType, fileName: sanitizeFileName(file.originalname, ext) };
}

const UPLOADS_PER_WINDOW = 20;
const WINDOW_MS = 60_000;

/**
 * In-memory upload rate limit: 20 per minute per user. Per process, so with several
 * instances the effective limit is multiplied; move it to Redis (or @nestjs/throttler
 * with a shared store) when the API scales out.
 */
@Injectable()
export class UploadRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const userId: string | undefined = context.switchToHttp().getRequest().user?.id;
    if (!userId) return true;

    const now = Date.now();
    const recent = (this.hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= UPLOADS_PER_WINDOW) {
      this.hits.set(userId, recent);
      throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, 'TOO_MANY_REQUESTS', 'Too many uploads; try again in a minute.');
    }
    recent.push(now);
    this.hits.set(userId, recent);

    if (this.hits.size > 10_000) this.prune(now);
    return true;
  }

  private prune(now: number) {
    for (const [userId, times] of this.hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) this.hits.delete(userId);
    }
  }
}
