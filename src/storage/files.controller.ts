import { Controller, ForbiddenException, Get, NotFoundException, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { LocalStorageService } from './local-storage.service.js';
import { contentDisposition } from './storage.service.js';

/**
 * Serves files from LocalStorageService. Links are signed and expire, so no
 * Bearer token is needed (the mobile app opens them in the browser).
 * An invalid or expired link gives 403, which tells clients to fetch a fresh URL.
 */
@Controller('v1/files')
export class FilesController {
  constructor(private readonly storage: LocalStorageService) {}

  @Get('download')
  async download(@Query() query: Record<string, unknown>, @Res() res: Response) {
    const file = this.storage.verify(query);
    if (!file) {
      throw new ForbiddenException('This link is invalid or has expired.');
    }

    const path = this.storage.pathFor(file.key);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) {
      throw new NotFoundException('File not found.');
    }

    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', String(info.size));
    res.setHeader('Content-Disposition', contentDisposition(file.fileName));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=0');
    createReadStream(path).pipe(res);
  }
}
