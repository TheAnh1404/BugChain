ALTER TABLE "User" ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "firstWalletConnectedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "firstBountyCreatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "firstReportSubmittedAt" TIMESTAMP(3);

CREATE TYPE "WalletInteractionAction" AS ENUM (
  'WALLET_CONNECTED',
  'BOUNTY_CREATED',
  'REPORT_SUBMITTED',
  'REPORT_APPROVED',
  'REWARD_CLAIMED',
  'BOUNTY_REFUNDED'
);

CREATE TABLE "Feedback" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "role" TEXT NOT NULL,
  "comment" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserWalletInteraction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "action" "WalletInteractionAction" NOT NULL,
  "txHash" TEXT,
  "stellarExplorerUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserWalletInteraction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID,
  "eventName" TEXT NOT NULL,
  "properties" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");
CREATE INDEX "Feedback_rating_idx" ON "Feedback"("rating");
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

CREATE INDEX "UserWalletInteraction_userId_idx" ON "UserWalletInteraction"("userId");
CREATE INDEX "UserWalletInteraction_walletAddress_idx" ON "UserWalletInteraction"("walletAddress");
CREATE INDEX "UserWalletInteraction_action_idx" ON "UserWalletInteraction"("action");
CREATE INDEX "UserWalletInteraction_txHash_idx" ON "UserWalletInteraction"("txHash");
CREATE INDEX "UserWalletInteraction_createdAt_idx" ON "UserWalletInteraction"("createdAt");

CREATE INDEX "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");
CREATE INDEX "AnalyticsEvent_eventName_idx" ON "AnalyticsEvent"("eventName");
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserWalletInteraction"
  ADD CONSTRAINT "UserWalletInteraction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
