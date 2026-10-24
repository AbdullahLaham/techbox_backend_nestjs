import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { StorageService } from './storage.service.js';

export type SignedDownload = {
  key: string;
  fileName: string;
  contentType: string;
  expiresAt: number;
};

const SAFE_KEY = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*(\.[A-Za-z0-9]+)?$/;

/**
 * Private files on the local disk, served by FilesController through HMAC-signed,
 * expiring links. Meant for development and single-server deployments; swap it for
 * a bucket provider in StorageModule when decision S1 is made.
 *
 * Env: STORAGE_LOCAL_DIR (default ./storage), STORAGE_SIGNING_SECRET,
 * PUBLIC_API_URL (default http://localhost:5000).
 */
@Injectable()
export class LocalStorageService implements StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly root: string;
  private readonly secret: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('STORAGE_LOCAL_DIR') || './storage');
    this.publicUrl = (config.get<string>('PUBLIC_API_URL') || 'http://localhost:5000').replace(/\/$/, '');

    const secret = config.get<string>('STORAGE_SIGNING_SECRET');
    if (!secret) {
      this.logger.warn(
        'STORAGE_SIGNING_SECRET is not set; using a random secret, so download links stop working after a restart.',
      );
    }
    this.secret = secret || randomBytes(32).toString('hex');
  }

  async put(key: string, body: Buffer | NodeJS.ReadableStream): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    if (Buffer.isBuffer(body)) {
      await writeFile(path, body);
    } else {
      await pipeline(body, createWriteStream(path));
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async getDownloadUrl(
    key: string,
    opts: { fileName: string; expiresInSec: number; contentType?: string },
  ): Promise<string> {
    this.pathFor(key);
    const download: SignedDownload = {
      key,
      fileName: opts.fileName,
      contentType: opts.contentType || 'application/octet-stream',
      expiresAt: Math.floor(Date.now() / 1000) + opts.expiresInSec,
    };
    const params = new URLSearchParams({
      key: download.key,
      name: download.fileName,
      type: download.contentType,
      exp: String(download.expiresAt),
      sig: this.sign(download),
    });
    return `${this.publicUrl}/v1/files/download?${params.toString()}`;
  }

  /** Returns the download when the signature is valid and not expired, else null. */
  verify(query: Record<string, unknown>): SignedDownload | null {
    const { key, name, type, exp, sig } = query;
    if ([key, name, type, exp, sig].some((v) => typeof v !== 'string')) return null;
    const download: SignedDownload = {
      key: key as string,
      fileName: name as string,
      contentType: type as string,
      expiresAt: Number(exp),
    };
    if (!Number.isInteger(download.expiresAt) || download.expiresAt < Date.now() / 1000) return null;
    if (!SAFE_KEY.test(download.key)) return null;

    const expected = Buffer.from(this.sign(download));
    const actual = Buffer.from(sig as string);
    return expected.length === actual.length && timingSafeEqual(expected, actual) ? download : null;
  }

  /** Absolute path of a key, refusing anything that could escape the storage root. */
  pathFor(key: string): string {
    const path = resolve(this.root, key);
    if (!SAFE_KEY.test(key) || !path.startsWith(this.root + sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return path;
  }

  private sign(d: SignedDownload): string {
    return createHmac('sha256', this.secret)
      .update([d.key, d.fileName, d.contentType, d.expiresAt].join('\n'))
      .digest('base64url');
  }
}
