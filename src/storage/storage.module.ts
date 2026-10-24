import { Module } from '@nestjs/common';
import { FilesController } from './files.controller.js';
import { LocalStorageService } from './local-storage.service.js';
import { STORAGE_SERVICE } from './storage.service.js';

// To switch provider (decision S1), bind STORAGE_SERVICE to a Bunny Storage or S3
// implementation here and drop FilesController, which only serves local files.
@Module({
  controllers: [FilesController],
  providers: [LocalStorageService, { provide: STORAGE_SERVICE, useExisting: LocalStorageService }],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
