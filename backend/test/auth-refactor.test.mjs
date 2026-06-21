import assert from 'node:assert/strict';
import { PrismaClient, SecurityLogAction } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

async function runTests() {
  console.log('Starting E2E Authentication & Authorization tests...');
  let passedCount = 0;

  // Generate unique test users
  const rand1 = Math.random().toString(36).substring(2, 10);
  const email1 = `test-${rand1}@example.com`;
  const username1 = `user_${rand1}`;
  const password = 'Password123';

  const rand2 = Math.random().toString(36).substring(2, 10);
  const email2 = `test-${rand2}@example.com`;
  const username2 = `user_${rand2}`;

  // 1. REGISTER TEST
  console.log('\n--- 1. Testing Register ---');
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email1,
        username: username1,
        password,
        confirmPassword: password,
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.data.message.includes('verify your email'));

    // Test duplicate checks
    const resDup = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email1,
        username: username1,
        password,
        confirmPassword: password,
      }),
    });
    assert.equal(resDup.status, 400);

    // Test weak password check
    const resWeak = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `weak-${rand1}@example.com`,
        username: `weak_${rand1}`,
        password: '123',
        confirmPassword: '123',
      }),
    });
    assert.equal(resWeak.status, 400);

    console.log('[PASS] Registration and input strength checks verified.');
    passedCount++;
  } catch (err) {
    console.error('[FAIL] Registration failed:', err);
    process.exit(1);
  }

  // 2. EMAIL VERIFICATION TEST
  console.log('\n--- 2. Testing Email Verification ---');
  let token1 = '';
  try {
    const user = await prisma.user.findUnique({
      where: { email: email1 },
    });
    assert.ok(user);
    assert.equal(user.emailVerified, false);
    assert.ok(user.emailVerificationToken);
    token1 = user.emailVerificationToken;

    const res = await fetch(`${API_URL}/auth/verify-email?token=${token1}`);
    assert.equal(res.status, 200);

    const userUpdated = await prisma.user.findUnique({
      where: { email: email1 },
    });
    assert.equal(userUpdated.emailVerified, true);
    assert.equal(userUpdated.emailVerificationToken, null);

    // Assert retry fails
    const resDup = await fetch(`${API_URL}/auth/verify-email?token=${token1}`);
    assert.equal(resDup.status, 400);

    console.log('[PASS] Email verification verified.');
    passedCount++;
  } catch (err) {
    console.error('[FAIL] Email verification failed:', err);
    process.exit(1);
  }

  // 3. LOGIN TEST
  console.log('\n--- 3. Testing Login ---');
  let accessToken = '';
  let refreshToken = '';
  try {
    // Fail login with wrong password
    const resFail = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email1, password: 'WrongPassword' }),
    });
    assert.equal(resFail.status, 401);

    // Success login
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email1, password }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.data.accessToken);
    assert.ok(data.data.refreshToken);
    assert.equal(data.data.user.email, email1);

    accessToken = data.data.accessToken;
    refreshToken = data.data.refreshToken;

    console.log('[PASS] Login flow and token generation verified.');
    passedCount++;
  } catch (err) {
    console.error('[FAIL] Login failed:', err);
    process.exit(1);
  }

  // 4. ACCESS & REFRESH TOKEN ROTATION
  console.log('\n--- 4. Testing Refresh Token Rotation ---');
  let newAccessToken = '';
  let newRefreshToken = '';
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.data.accessToken);
    assert.ok(data.data.refreshToken);

    newAccessToken = data.data.accessToken;
    newRefreshToken = data.data.refreshToken;

    console.log('[PASS] Refresh token rotation successful.');
    passedCount++;
  } catch (err) {
    console.error('[FAIL] Refresh token rotation failed:', err);
    process.exit(1);
  }

  // 5. TOKEN REUSE DETECTION
  console.log('\n--- 5. Testing Token Reuse Detection ---');
  try {
    // Attempt to reuse old rotated refresh token
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }), // old token
    });
    assert.equal(res.status, 401);

    // Assert that reuse detection revoked all sessions for user1
    const activeSessions = await prisma.userSession.findMany({
      where: { userId: (await prisma.user.findUnique({ where: { email: email1 } })).id, revokedAt: null },
    });
    assert.equal(activeSessions.length, 0);

    console.log('[PASS] Token reuse detection successfully revoked all active sessions.');
    passedCount++;
  } catch (err) {
    console.error('[FAIL] Token reuse detection failed:', err);
    process.exit(1);
  }

  // 6. ACCOUNT LOCKING TEST
  console.log('\n--- 6. Testing Account Locking ---');
  try {
    // 6a. Register user2 and verify
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email2,
        username: username2,
        password,
        confirmPassword: password,
      }),
    });
    const u2 = await prisma.user.findUnique({ where: { email: email2 } });
    await prisma.user.update({
      where: { id: u2.id },
      data: { emailVerified: true, emailVerificationToken: null },
    });

    // 6b. Try wrong password 5 times
    for (let i = 0; i < 4; i++) {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email2, password: 'WrongPassword' }),
      });
      assert.equal(res.status, 401);
    }

    // 5th time should lock the account
    const resLock = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email2, password: 'WrongPassword' }),
    });
    assert.equal(resLock.status, 401);
    const dataLock = await resLock.json();
    assert.ok(dataLock.message.includes('locked'));

    // Try logging in with the CORRECT password while locked
    const resCorrectFail = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email2, password }),
    });
    assert.equal(resCorrectFail.status, 401);
    assert.ok((await resCorrectFail.json()).message.includes('temporarily locked'));

    console.log('[PASS] Account locking after 5 failures verified.');
    passedCount++;
  } catch (err) {
    console.error('[FAIL] Account locking failed:', err);
    process.exit(1);
  }

  // 7. CHANGE PASSWORD TEST
  console.log('\n--- 7. Testing Change Password ---');
  let authHeader = '';
  try {
    // Login user1 again (previous sessions were revoked by reuse detection)
    const resLogin = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email1, password }),
    });
    const loginData = await resLogin.json();
    accessToken = loginData.data.accessToken;
    authHeader = `Bearer ${accessToken}`;

    // Establish a second session for user1 to test invalidation of other sessions
    const resLogin2 = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email1, password }),
    });
    const loginData2 = await resLogin2.json();
    const otherAccessToken = loginData2.data.accessToken;

    // Change password
    const newPassword = 'NewPassword123';
    const resChange = await fetch(`${API_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        currentPassword: password,
        newPassword,
        confirmNewPassword: newPassword,
      }),
    });
    assert.equal(resChange.status, 201);

    // Verify other sessions are revoked
    const resOtherMe = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${otherAccessToken}` },
    });
    assert.equal(resOtherMe.status, 401); // should be revoked!

    // Verify current session is still active
    const resCurrentMe = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: authHeader },
    });
    assert.equal(resCurrentMe.status, 200);

    // Reset password variable for subsequent tests
    console.log('[PASS] Change password and other sessions revocation verified.');
    passedCount++;
  } catch (err) {
    console.error('[FAIL] Change password failed:', err);
    process.exit(1);
  }

  // 8. FORGOT PASSWORD TEST
  console.log('\n--- 8. Testing Forgot Password ---');
  try {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email1 }),
    });
    assert.equal(res.status, 201);

    const user = await prisma.user.findUnique({ where: { email: email1 } });
    assert.ok(user.passwordResetToken);
    assert.ok(user.passwordResetExpires);

    console.log('[PASS] Forgot password token generation verified.');
    passedCount++;
  } catch (err) {
    console.error('[FAIL] Forgot password failed:', err);
    process.exit(1);
  }

  // 9. RESET PASSWORD TEST
  console.log('\n--- 9. Testing Reset Password ---');
  try {
    const user = await prisma.user.findUnique({ where: { email: email1 } });
    const resetToken = user.passwordResetToken;

    const resetPasswordVal = 'ResetPassword123';
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetToken,
        password: resetPasswordVal,
        confirmPassword: resetPasswordVal,
      }),
    });
    assert.equal(res.status, 201);

    // Verify password reset cleared token
    const userUpdated = await prisma.user.findUnique({ where: { email: email1 } });
    assert.equal(userUpdated.passwordResetToken, null);

    // Assert that we can login with the new password
    const resLogin = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email1, password: resetPasswordVal }),
    });
    assert.equal(resLogin.status, 201);
    const data = await resLogin.json();
    accessToken = data.data.accessToken;
    refreshToken = data.data.refreshToken;
    authHeader = `Bearer ${accessToken}`;

    console.log('[PASS] Reset password verified.');
    passedCount++;
  } catch (err) {
    console.error('[FAIL] Reset password failed:', err);
    process.exit(1);
  }

  // 10. SESSION REVOCATION TEST
  console.log('\n--- 10. Testing Sessions Revocation ---');
  try {
    // Create another session
    const resLogin2 = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email1, password: 'ResetPassword123' }),
    });
    const data2 = await resLogin2.json();
    const otherSessionId = data2.data.accessToken ? JSON.parse(Buffer.from(data2.data.accessToken.split('.')[1], 'base64').toString()).sid : '';

    // List sessions
    const resSessions = await fetch(`${API_URL}/auth/sessions`, {
      headers: { Authorization: authHeader },
    });
    assert.equal(resSessions.status, 200);
    const sessionsList = (await resSessions.json()).data;
    assert.ok(sessionsList.length >= 2);
    
    const currentSession = sessionsList.find(s => s.isCurrent);
    assert.ok(currentSession);

    // Revoke the second session
    const resRevoke = await fetch(`${API_URL}/auth/sessions/${otherSessionId}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    });
    assert.equal(resRevoke.status, 200);

    // Verify revoked session is no longer active
    const resSessions2 = await fetch(`${API_URL}/auth/sessions`, {
      headers: { Authorization: authHeader },
    });
    const sessionsList2 = (await resSessions2.json()).data;
    assert.equal(sessionsList2.find(s => s.id === otherSessionId), undefined);

    // Invalidate current session using logout
    const resLogout = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    assert.equal(resLogout.status, 201);

    // Verify that we are no longer authenticated
    const resMe = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: authHeader },
    });
    assert.equal(resMe.status, 401);

    console.log('[PASS] Session listing, individual revocation, and logout verified.');
    passedCount++;
  } catch (err) {
    console.error('[FAIL] Sessions revocation failed:', err);
    process.exit(1);
  }

  // Cleanup Database
  console.log('\nCleaning up test users...');
  const testUsers = await prisma.user.findMany({
    where: {
      email: { in: [email1, email2] },
    },
  });
  for (const user of testUsers) {
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log(`\n=========================================`);
  console.log(`ALL TESTS PASSED: ${passedCount}/10 tests succeeded.`);
  console.log(`=========================================`);
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
