import { AuditAction, UserRole } from '@prisma/client';

export const PERMISSION_MATRIX: Record<UserRole, AuditAction[]> = {
  [UserRole.HUNTER]: [
    AuditAction.SUBMIT_REPORT,
    AuditAction.CLAIM_REWARD,
  ],
  [UserRole.OWNER]: [
    AuditAction.CREATE_BOUNTY,
    AuditAction.APPROVE_REPORT,
    AuditAction.REJECT_REPORT,
    AuditAction.REFUND_BOUNTY,
  ],
  [UserRole.REVIEWER]: [
    AuditAction.APPROVE_REPORT,
    AuditAction.REJECT_REPORT,
  ],
  [UserRole.ADMIN]: [
    AuditAction.CREATE_BOUNTY,
    AuditAction.SUBMIT_REPORT,
    AuditAction.APPROVE_REPORT,
    AuditAction.REJECT_REPORT,
    AuditAction.CLAIM_REWARD,
    AuditAction.REFUND_BOUNTY,
  ],
};

export function roleCan(role: UserRole, action: AuditAction) {
  return role === UserRole.ADMIN || PERMISSION_MATRIX[role].includes(action);
}
