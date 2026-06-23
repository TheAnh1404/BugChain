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

  const emailProvider = String(config.EMAIL_PROVIDER ?? 'console').trim().toLowerCase();
  if (!['console', 'smtp'].includes(emailProvider)) {
    throw new Error('EMAIL_PROVIDER must be either "console" or "smtp"');
  }

  if (emailProvider === 'smtp') {
    const smtpPortValue = String(config.SMTP_PORT ?? '').trim();
    const smtpPort = Number(smtpPortValue);
    if (smtpPortValue && (!Number.isInteger(smtpPort) || smtpPort <= 0)) {
      throw new Error('SMTP_PORT must be a valid positive integer');
    }

    const smtpSecure = config.SMTP_SECURE;
    if (
      smtpSecure !== undefined &&
      !['true', 'false'].includes(String(smtpSecure).trim().toLowerCase())
    ) {
      throw new Error('SMTP_SECURE must be "true" or "false" when provided');
    }
  }

  const inlineReset = String(config.DEV_INLINE_PASSWORD_RESET_LINK ?? '')
    .trim()
    .toLowerCase();
  if (inlineReset && !['true', 'false'].includes(inlineReset)) {
    throw new Error('DEV_INLINE_PASSWORD_RESET_LINK must be "true" or "false" when provided');
  }

  if (inlineReset === 'true' && String(config.NODE_ENV ?? '').trim() === 'production') {
    throw new Error('DEV_INLINE_PASSWORD_RESET_LINK cannot be enabled in production');
  }

  const encryptionKey = String(config.REPORT_ENCRYPTION_KEY);
  const isHexKey = /^[a-fA-F0-9]{64}$/.test(encryptionKey);
  const decodedLength = Buffer.from(encryptionKey, 'base64').length;

  if (!isHexKey && decodedLength !== 32) {
    throw new Error('REPORT_ENCRYPTION_KEY must be 64 hex characters or base64 for 32 bytes');
  }

  return config;
}
