import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AccessPolicy } from './access-policy';
import { StorageService } from './storage.service';
import { ThumbnailService } from './thumbnail.service';

/** Storage access for any module: every operation goes through AccessPolicy. */
@Module({
  imports: [AuditModule],
  providers: [StorageService, AccessPolicy, ThumbnailService],
  exports: [StorageService, AccessPolicy],
})
export class StorageModule {}
