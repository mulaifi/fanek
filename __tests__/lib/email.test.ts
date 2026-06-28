import {
  getSmtpConfig,
  isSmtpConfigured,
  isPasswordResetEnabled,
  sendMail,
  sendPasswordResetEmail,
} from '@/lib/email';
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
  test('true when enabled and host/port/from present (no auth)', () => {
    expect(isSmtpConfigured(settingsWith({ enabled: true, host: 'h', port: 587, from: 'a@b.c' }))).toBe(true);
  });

  test('CR6: false when a username is set but no password (incomplete auth pair)', () => {
    expect(
      isSmtpConfigured(settingsWith({ enabled: true, host: 'h', port: 587, from: 'a@b.c', user: 'mailer' }))
    ).toBe(false);
  });

  test('CR6: true when a username AND password are both present', () => {
    expect(
      isSmtpConfigured(settingsWith({ enabled: true, host: 'h', port: 587, from: 'a@b.c', user: 'mailer', pass: 'p' }))
    ).toBe(true);
  });
});

describe('isPasswordResetEnabled (#6)', () => {
  const configured = { enabled: true, host: 'h', port: 587, from: 'a@b.c' };
  const ORIGINAL = process.env.NEXTAUTH_URL;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = ORIGINAL;
  });

  test('true only when SMTP configured AND NEXTAUTH_URL set', () => {
    process.env.NEXTAUTH_URL = 'https://app.example.com';
    expect(isPasswordResetEnabled(settingsWith(configured))).toBe(true);
  });

  test('false when NEXTAUTH_URL is unset even if SMTP is configured', () => {
    delete process.env.NEXTAUTH_URL;
    expect(isPasswordResetEnabled(settingsWith(configured))).toBe(false);
  });

  test('false when SMTP not configured even if NEXTAUTH_URL is set', () => {
    process.env.NEXTAUTH_URL = 'https://app.example.com';
    expect(isPasswordResetEnabled(settingsWith({ enabled: false }))).toBe(false);
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
      host: string; port: number; secure: boolean;
      connectionTimeout: number; greetingTimeout: number; socketTimeout: number;
      auth: { user: string; pass: string };
    };
    expect(transportArg.host).toBe('smtp.example.com');
    expect(transportArg.port).toBe(465);
    expect(transportArg.secure).toBe(true);
    // #5: bounded timeouts so a slow SMTP server cannot hang the send indefinitely.
    expect(transportArg.connectionTimeout).toBe(10000);
    expect(transportArg.greetingTimeout).toBe(10000);
    expect(transportArg.socketTimeout).toBe(20000);
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
