import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export type ReportSensitiveContent = {
  description: string;
  impact: string;
  stepsToReproduce: string;
  recommendation: string;
};

export type EncryptedReportContent = {
  encryptedContent: string;
  iv: string;
  authTag: string;
};

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

@Injectable()
export class ReportEncryptionService {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    this.key = this.parseKey(configService.get<string>('REPORT_ENCRYPTION_KEY'));
  }

  encrypt(content: ReportSensitiveContent): EncryptedReportContent {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const plaintext = Buffer.from(JSON.stringify(content), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    return {
      encryptedContent: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(data: {
    encryptedContent?: string | null;
    iv?: string | null;
    authTag?: string | null;
    description?: string;
    impact?: string;
    stepsToReproduce?: string;
    recommendation?: string;
  }): ReportSensitiveContent {
    if (!data.encryptedContent || !data.iv || !data.authTag) {
      return {
        description: data.description ?? '',
        impact: data.impact ?? '',
        stepsToReproduce: data.stepsToReproduce ?? '',
        recommendation: data.recommendation ?? '',
      };
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(data.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(data.authTag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(data.encryptedContent, 'base64')),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString('utf8')) as ReportSensitiveContent;
  }

  private parseKey(value?: string): Buffer {
    if (!value) {
      throw new Error('REPORT_ENCRYPTION_KEY is required for AES-256 report encryption');
    }

    const trimmed = value.trim();
    const key = /^[a-fA-F0-9]{64}$/.test(trimmed)
      ? Buffer.from(trimmed, 'hex')
      : Buffer.from(trimmed, 'base64');

    if (key.length !== 32) {
      throw new Error('REPORT_ENCRYPTION_KEY must decode to exactly 32 bytes');
    }

    return key;
  }
}
