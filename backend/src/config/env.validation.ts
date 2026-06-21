const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_SECRET',
  'REPORT_ENCRYPTION_KEY',
] as const;

export function validateEnv(config: Record<string, unknown>) {
  const missing = REQUIRED_ENV.filter((key) => !String(config[key] ?? '').trim());

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const encryptionKey = String(config.REPORT_ENCRYPTION_KEY);
  const isHexKey = /^[a-fA-F0-9]{64}$/.test(encryptionKey);
  const decodedLength = Buffer.from(encryptionKey, 'base64').length;

  if (!isHexKey && decodedLength !== 32) {
    throw new Error('REPORT_ENCRYPTION_KEY must be 64 hex characters or base64 for 32 bytes');
  }

  return config;
}
