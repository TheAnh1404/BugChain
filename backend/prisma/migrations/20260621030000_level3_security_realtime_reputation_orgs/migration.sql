-- Level 3 role model. Existing Level 2 USER records become HUNTER.
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'HUNTER', 'REVIEWER', 'ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole"
  USING (
    CASE
      WHEN "role"::text = 'USER' THEN 'HUNTER'
      ELSE "role"::text
    END
  )::"UserRole";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'HUNTER';
DROP TYPE "UserRole_old";

CREATE TYPE "AuditAction" AS ENUM (
  'CREATE_BOUNTY',
  'SUBMIT_REPORT',
  'APPROVE_REPORT',
  'REJECT_REPORT',
  'CLAIM_REWARD',
  'REFUND_BOUNTY'
);

CREATE TYPE "EntityType" AS ENUM (
  'BOUNTY',
  'REPORT',
  'TRANSACTION',
  'ORGANIZATION',
  'PROJECT'
);

CREATE TYPE "NotificationType" AS ENUM (
  'REPORT_APPROVED',
  'REPORT_REJECTED',
  'REWARD_CLAIMED',
  'BOUNTY_REFUNDED',
  'NEW_REPORT'
);

CREATE TYPE "HunterBadge" AS ENUM (
  'FIRST_REPORT',
  'CRITICAL_FINDER',
  'TOP_HUNTER',
  'THOUSAND_XLM_EARNED'
);

CREATE TYPE "OrganizationRole" AS ENUM (
  'OWNER',
  'MEMBER',
  'REVIEWER'
);

CREATE TYPE "ReviewAssignmentStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

ALTER TABLE "Bounty" ADD COLUMN "organizationId" UUID;
ALTER TABLE "Bounty" ADD COLUMN "projectId" UUID;

ALTER TABLE "Report" ADD COLUMN "encrypted_content" TEXT;
ALTER TABLE "Report" ADD COLUMN "iv" TEXT;
ALTER TABLE "Report" ADD COLUMN "auth_tag" TEXT;

ALTER TABLE "Review" ADD COLUMN "reviewerSlot" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Review" ADD COLUMN "reviewRound" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "AuditLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "action" "AuditAction" NOT NULL,
  "entityType" "EntityType" NOT NULL,
  "entityId" UUID NOT NULL,
  "txHash" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReputationProfile" (
  "userId" UUID NOT NULL,
  "approvedReports" INTEGER NOT NULL DEFAULT 0,
  "rejectedReports" INTEGER NOT NULL DEFAULT 0,
  "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "earnedXLM" DECIMAL(20,7) NOT NULL DEFAULT 0,
  "severityScore" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReputationProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "ReputationBadge" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "badge" "HunterBadge" NOT NULL,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReputationBadge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Organization" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationMember" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "invitedById" UUID,
  "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewAssignment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reportId" UUID NOT NULL,
  "reviewerId" UUID NOT NULL,
  "reviewerOrder" INTEGER NOT NULL,
  "status" "ReviewAssignmentStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "ReviewAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");
CREATE UNIQUE INDEX "Project_organizationId_slug_key" ON "Project"("organizationId", "slug");
CREATE UNIQUE INDEX "ReputationBadge_userId_badge_key" ON "ReputationBadge"("userId", "badge");
CREATE UNIQUE INDEX "ReviewAssignment_reportId_reviewerId_key" ON "ReviewAssignment"("reportId", "reviewerId");
CREATE UNIQUE INDEX "ReviewAssignment_reportId_reviewerOrder_key" ON "ReviewAssignment"("reportId", "reviewerOrder");

CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");
CREATE INDEX "Bounty_organizationId_idx" ON "Bounty"("organizationId");
CREATE INDEX "Bounty_projectId_idx" ON "Bounty"("projectId");
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX "Organization_ownerId_idx" ON "Organization"("ownerId");
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");
CREATE INDEX "OrganizationMember_role_idx" ON "OrganizationMember"("role");
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");
CREATE INDEX "ReputationBadge_badge_idx" ON "ReputationBadge"("badge");
CREATE INDEX "ReviewAssignment_reviewerId_idx" ON "ReviewAssignment"("reviewerId");
CREATE INDEX "ReviewAssignment_status_idx" ON "ReviewAssignment"("status");

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReputationProfile"
  ADD CONSTRAINT "ReputationProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReputationBadge"
  ADD CONSTRAINT "ReputationBadge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationMember"
  ADD CONSTRAINT "OrganizationMember_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationMember"
  ADD CONSTRAINT "OrganizationMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Bounty"
  ADD CONSTRAINT "Bounty_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Bounty"
  ADD CONSTRAINT "Bounty_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReviewAssignment"
  ADD CONSTRAINT "ReviewAssignment_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewAssignment"
  ADD CONSTRAINT "ReviewAssignment_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
