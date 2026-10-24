/**
 * File storage behind an interface so the provider can be swapped
 * (ASSIGNMENTS_SPEC.md 7.2, decision S1: Bunny Storage or any S3-compatible bucket).
 * Inject it with `@Inject(STORAGE_SERVICE)`.
 */
export interface StorageService {
  put(key: string, body: Buffer | NodeJS.ReadableStream, opts: { contentType: string }): Promise<void>;
  delete(key: string): Promise<void>;
  /** Short-lived signed URL (or CDN URL). `fileName` sets Content-Disposition. */
  getDownloadUrl(
    key: string,
    opts: { fileName: string; expiresInSec: number; contentType?: string },
  ): Promise<string>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

/** RFC 5987 `Content-Disposition` that keeps non-ASCII (e.g. Arabic) names intact. */
export function contentDisposition(fileName: string): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
