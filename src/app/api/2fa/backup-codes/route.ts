import { z } from 'zod';
import { checkPassword } from '@/lib/password';
import prisma from '@/lib/prisma';
import { parseRequest } from '@/lib/request';
import { badRequest, json, notFound, serviceUnavailable } from '@/lib/response';
import { generateBackupCodes } from '@/lib/two-factor/backup-codes';
import {
  decryptSecret,
  getTwoFactorConfigurationError,
  isTwoFactorConfigured,
} from '@/lib/two-factor/crypto';
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/two-factor/rate-limit';
import { isOtpReplayed, markOtpUsed } from '@/lib/two-factor/replay-prevention';
import { verifyTotp } from '@/lib/two-factor/totp';
import { getUser } from '@/queries/prisma/user';

export async function GET(request: Request) {
  if (process.env.CLOUD_MODE) {
    return notFound();
  }

  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  if (!isTwoFactorConfigured()) {
    return serviceUnavailable(getTwoFactorConfigurationError());
  }

  const userId = auth.user.id;

  const twoFactor = await prisma.client.twoFactorAuth.findUnique({ where: { userId } });
  if (!twoFactor?.isEnabled) {
    return badRequest({
      code: 'two-factor-error-not-enabled',
      message: '2FA is not enabled',
    });
  }

  const remaining = await prisma.client.twoFactorBackupCode.count({
    where: { userId, used: false },
  });
  const total = await prisma.client.twoFactorBackupCode.count({
    where: { userId },
  });

  return json({ remaining, total });
}

export async function POST(request: Request) {
  if (process.env.CLOUD_MODE) {
    return notFound();
  }

  const schema = z
    .object({
      password: z.string().optional(),
      token: z.string().length(6).optional(),
    })
    .refine(data => !!data.password || !!data.token, {
      message: 'Either password or token is required',
    });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  if (!isTwoFactorConfigured()) {
    return serviceUnavailable(getTwoFactorConfigurationError());
  }

  const userId = auth.user.id;
  const { password, token } = body;

  const twoFactor = await prisma.client.twoFactorAuth.findUnique({ where: { userId } });
  if (!twoFactor?.isEnabled) {
    return badRequest({
      code: 'two-factor-error-not-enabled',
      message: '2FA is not enabled',
    });
  }

  // Rate limiting check
  const rateCheck = await checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return Response.json(
      {
        error: {
          code: 'two-factor-error-too-many-attempts',
          message: 'Too many failed attempts',
          lockedUntil: rateCheck.lockedUntil,
        },
      },
      { status: 429 },
    );
  }

  // Verify password if provided
  if (password) {
    const userWithPw = await getUser(userId, { includePassword: true });
    if (!userWithPw || !checkPassword(password, userWithPw.password)) {
      const { lockedUntil } = await recordFailedAttempt(userId);
      return badRequest({
        code: 'two-factor-error-incorrect-password',
        message: 'Incorrect password',
        ...(lockedUntil && { lockedUntil }),
      });
    }
  }

  // Verify TOTP token if provided
  if (token) {
    if (await isOtpReplayed(userId, token)) {
      return badRequest({
        code: 'two-factor-error-code-used',
        message: 'Code already used',
      });
    }

    const secret = decryptSecret(twoFactor.secret);
    if (!(await verifyTotp(token, secret))) {
      const { lockedUntil } = await recordFailedAttempt(userId);
      return badRequest({
        code: 'two-factor-error-invalid-code',
        message: 'Invalid verification code',
        ...(lockedUntil && { lockedUntil }),
      });
    }
  }

  // Generate new backup codes
  const { plaintext, hashed } = await generateBackupCodes();

  await prisma.transaction(async tx => {
    await tx.twoFactorBackupCode.deleteMany({ where: { userId } });
    await tx.twoFactorBackupCode.createMany({
      data: hashed.map(codeHash => ({ userId, codeHash })),
    });
    if (token) {
      await markOtpUsed(userId, token, tx);
    }
  });

  await resetRateLimit(userId);

  return json({ backupCodes: plaintext });
}
