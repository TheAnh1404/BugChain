import { Module } from '@nestjs/common';
import { ReportEncryptionService } from './report-encryption.service';

@Module({
  providers: [ReportEncryptionService],
  exports: [ReportEncryptionService],
})
export class SecurityModule {}
