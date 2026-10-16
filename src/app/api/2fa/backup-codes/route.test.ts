import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = {
    twoFactorBackupCode: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  };

  return {
    parseRequest: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    transaction: vi.fn(async (cb: any) => cb(tx)),
    tx,
    isTwoFactorConfigured: vi.fn(),
    generateBackupCodes: vi.fn(),
    decryptSecret: vi.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    recordFailedAttempt: vi.fn().mockResolvedValue({}),
    resetRateLimit: vi.fn().mockResolvedValue(undefined),
    isOtpReplayed: vi.fn().mockResolvedValue(false),
    markOtpUsed: vi.fn().mockResolvedValue(undefined),
    verifyTotp: vi.fn().mockResolvedValue(true),
    checkPassword: vi.fn().mockReturnValue(true),
    getUser: vi.fn().mockResolvedValue({ id: 'user-1', password: 'hashed-password' }),
  };
});

vi.mock('@/lib/request', () => ({
  parseRequest: mocks.parseRequest,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    client: {
      twoFactorAuth: {
        findUnique: mocks.findUnique,
      },
      twoFactorBackupCode: {
        count: mocks.count,
      },
    },
    transaction: mocks.transaction,
  },
}));

vi.mock('@/lib/two-factor/crypto', () => ({
  decryptSecret: mocks.decryptSecret,
  getTwoFactorConfigurationError: () => ({
    code: 'two-factor-error-not-configured',
    message: 'TWO_FACTOR_ENCRYPTION_KEY is missing or invalid',
  }),
  isTwoFactorConfigured: mocks.isTwoFactorConfigured,
}));

vi.mock('@/lib/two-factor/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  recordFailedAttempt: mocks.recordFailedAttempt,
  resetRateLimit: mocks.resetRateLimit,
}));

vi.mock('@/lib/two-factor/replay-prevention', () => ({
  isOtpReplayed: mocks.isOtpReplayed,
  markOtpUsed: mocks.markOtpUsed,
}));

vi.mock('@/lib/two-factor/totp', () => ({
  verifyTotp: mocks.verifyTotp,
}));

vi.mock('@/lib/two-factor/backup-codes', () => ({
  generateBackupCodes: mocks.generateBackupCodes,
}));

vi.mock('@/lib/password', () => ({
  checkPassword: mocks.checkPassword,
}));

vi.mock('@/queries/prisma/user', () => ({
  getUser: mocks.getUser,
}));

import { GET, POST } from './route';

beforeEach(() => {
  mocks.parseRequest.mockReset();
  mocks.findUnique.mockReset();
  mocks.count.mockReset();
  mocks.tx.twoFactorBackupCode.deleteMany.mockReset();
  mocks.tx.twoFactorBackupCode.createMany.mockReset();
  mocks.generateBackupCodes.mockReset();
  mocks.isTwoFactorConfigured.mockReset();

  mocks.isTwoFactorConfigured.mockReturnValue(true);
  mocks.generateBackupCodes.mockResolvedValue({
    plaintext: ['CODE-1', 'CODE-2'],
    hashed: ['hash1', 'hash2'],
  });
});

test('GET returns backup code counts when 2FA is enabled', async () => {
  mocks.parseRequest.mockResolvedValue({
    auth: { user: { id: 'user-1' } },
  });
  mocks.findUnique.mockResolvedValue({
    userId: 'user-1',
    isEnabled: true,
  });
  mocks.count
    .mockResolvedValueOnce(8) // remaining
    .mockResolvedValueOnce(10); // total

  const res = await GET(new Request('http://localhost/api/2fa/backup-codes'));
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data).toEqual({ remaining: 8, total: 10 });
});

test('GET returns 400 if 2FA is not enabled', async () => {
  mocks.parseRequest.mockResolvedValue({
    auth: { user: { id: 'user-1' } },
  });
  mocks.findUnique.mockResolvedValue(null);

  const res = await GET(new Request('http://localhost/api/2fa/backup-codes'));
  expect(res.status).toBe(400);
});

test('POST regenerates backup codes with valid password', async () => {
  mocks.parseRequest.mockResolvedValue({
    auth: { user: { id: 'user-1' } },
    body: { password: 'valid-password' },
  });
  mocks.findUnique.mockResolvedValue({
    userId: 'user-1',
    isEnabled: true,
  });

  const res = await POST(new Request('http://localhost/api/2fa/backup-codes', { method: 'POST' }));
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data).toEqual({ backupCodes: ['CODE-1', 'CODE-2'] });
  expect(mocks.tx.twoFactorBackupCode.deleteMany).toHaveBeenCalledWith({
    where: { userId: 'user-1' },
  });
  expect(mocks.tx.twoFactorBackupCode.createMany).toHaveBeenCalled();
});
