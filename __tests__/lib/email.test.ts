import { getSmtpConfig, isSmtpConfigured, sendMail, sendPasswordResetEmail } from '@/lib/email';
import { encrypt } from '@/lib/encryption';

const sendMailMock = jest.fn();
const createTransportMock = jest.fn(() => ({ sendMail: sendMailMock }));

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: (...args: unknown[]) => createTransportMock(...args) },
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const SECRET = 'a'.repeat(64);

function settingsWith(smtp: Record<string, unknown>) {
  return { smtp } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXTAUTH_SECRET = SECRET;
});

describe('getSmtpConfig', () => {
  test('returns {} when settings or smtp missing', () => {
    expect(getSmtpConfig(null)).toEqual({});
    expect(getSmtpConfig(settingsWith(undefined as never))).toEqual({});
  });

  test('returns the smtp object', () => {
    const cfg = { enabled: true, host: 'smtp.example.com' };
    expect(getSmtpConfig(settingsWith(cfg))).toEqual(cfg);
  });
});

describe('isSmtpConfigured', () => {
  test('false when disabled', () => {
    expect(isSmtpConfigured(settingsWith({ enabled: false, host: 'h', port: 587, from: 'a@b.c' }))).toBe(false);
  });
  test('false when missing host/port/from', () => {
    expect(isSmtpConfigured(settingsWith({ enabled: true }))).toBe(false);
    expect(isSmtpConfigured(settingsWith({ enabled: true, host: 'h' }))).toBe(false);
  });
  test('true when enabled and host/port/from present', () => {
    expect(isSmtpConfigured(settingsWith({ enabled: true, host: 'h', port: 587, from: 'a@b.c' }))).toBe(true);
  });
});

describe('sendMail', () => {
  test('throws when SMTP is not configured', async () => {
    await expect(sendMail(settingsWith({ enabled: false }), { to: 'x@y.z', subject: 's', html: '<p>h</p>' })).rejects.toThrow(/not configured/i);
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  test('decrypts the stored password before building the transport', async () => {
    const encPass = encrypt('s3cret-pass', SECRET);
    const settings = settingsWith({
      enabled: true,
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      user: 'mailer',
      pass: encPass,
      from: 'noreply@example.com',
    });

    await sendMail(settings, { to: 'user@example.com', subject: 'Hi', html: '<p>Hi</p>' });

    expect(createTransportMock).toHaveBeenCalledTimes(1);
    const transportArg = createTransportMock.mock.calls[0][0] as {
      host: string; port: number; secure: boolean; auth: { user: string; pass: string };
    };
    expect(transportArg.host).toBe('smtp.example.com');
    expect(transportArg.port).toBe(465);
    expect(transportArg.secure).toBe(true);
    // The decrypted (plaintext) password is used, never the ciphertext
    expect(transportArg.auth.user).toBe('mailer');
    expect(transportArg.auth.pass).toBe('s3cret-pass');

    const mailArg = sendMailMock.mock.calls[0][0] as { from: string; to: string };
    expect(mailArg.from).toBe('noreply@example.com');
    expect(mailArg.to).toBe('user@example.com');
  });
});

describe('sendPasswordResetEmail', () => {
  test('sends an email containing the reset URL', async () => {
    const settings = settingsWith({
      enabled: true,
      host: 'smtp.example.com',
      port: 587,
      from: 'noreply@example.com',
    });
    const url = 'https://app.example.com/reset-password?token=abc123';
    await sendPasswordResetEmail(settings, 'user@example.com', url);

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mailArg = sendMailMock.mock.calls[0][0] as { to: string; html: string; text?: string };
    expect(mailArg.to).toBe('user@example.com');
    expect(mailArg.html).toContain(url);
    expect(mailArg.text).toContain(url);
  });
});
