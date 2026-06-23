import { Module } from '@nestjs/common';
import { ReportEncryptionService } from './report-encryption.service';
import { StellarValidationService } from './stellar-validation.service';

@Module({
  providers: [ReportEncryptionService, StellarValidationService],
  exports: [ReportEncryptionService, StellarValidationService],
})
export class SecurityModule {}
