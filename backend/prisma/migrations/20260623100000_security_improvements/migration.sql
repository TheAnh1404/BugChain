ALTER TABLE "User" ADD COLUMN "rsaPublicKey" TEXT;

ALTER TABLE "Report" ADD COLUMN "encrypted_aes_key" TEXT;
ALTER TABLE "Report" ADD COLUMN "encryptionScheme" TEXT DEFAULT 'SERVER_AES_GCM';

CREATE TABLE "SyncCheckpoint" (
  "serviceName" TEXT NOT NULL,
  "lastProcessedLedger" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SyncCheckpoint_pkey" PRIMARY KEY ("serviceName")
);
