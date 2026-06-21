import assert from 'node:assert/strict';
import { AuditAction, UserRole } from '@prisma/client';
import { PERMISSION_MATRIX, roleCan } from '../dist/common/security/permission-matrix.js';

assert.deepEqual(Object.keys(PERMISSION_MATRIX).sort(), [
  UserRole.ADMIN,
  UserRole.HUNTER,
  UserRole.OWNER,
  UserRole.REVIEWER,
].sort());

assert.equal(roleCan(UserRole.HUNTER, AuditAction.SUBMIT_REPORT), true);
assert.equal(roleCan(UserRole.HUNTER, AuditAction.APPROVE_REPORT), false);

for (const action of Object.values(AuditAction)) {
  assert.equal(roleCan(UserRole.ADMIN, action), true);
}

console.log('permission matrix tests passed');
