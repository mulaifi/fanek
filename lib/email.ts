import nodemailer from 'nodemailer';
import type { Settings } from '@prisma/client';
import { decrypt } from '@/lib/encryption';

/**
 * SMTP configuration as stored (JSON) in the Settings.smtp column.
 * `pass` is encrypted at rest with the same helper used for OAuth client secrets.
 */
export interface SmtpConfig {
  enabled?: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  /** Encrypted at rest (lib/encryption). Decrypted only at send time. */
  pass?: string;
  from?: string;
}

type SettingsLike = Pick<Settings, 'smtp'> | null;

export interface SendMailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Read the SMTP config object out of settings, defaulting to {}. */
export function getSmtpConfig(settings: SettingsLike): SmtpConfig {
  if (!settings || !settings.smtp || typeof settings.smtp !== 'object') return {};
  return settings.smtp as SmtpConfig;
}

/** True when SMTP is enabled and has the minimum fields required to send mail. */
export function isSmtpConfigured(settings: SettingsLike): boolean {
  const c = getSmtpConfig(settings);
  const baseOk = !!(c.enabled && c.host && c.port && c.from);
  // Auth must be a COMPLETE pair: either no username (unauthenticated relay) or a
  // username WITH a password. A username without a password would advertise the
  // feature but fail at delivery time.
  const authComplete = !c.user || !!c.pass;
  return baseOk && authComplete;
}

/**
 * Whether the email-based password reset flow is actually usable end to end.
 * Requires both SMTP to be configured AND a canonical NEXTAUTH_URL (the reset link
 * is built only from it; the Host header is never trusted). Centralized here so the
 * public settings endpoint and the forgot-password handler can never drift.
 */
export function isPasswordResetEnabled(settings: SettingsLike): boolean {
  return isSmtpConfigured(settings) && Boolean(process.env.NEXTAUTH_URL);
}

function buildTransport(c: SmtpConfig): nodemailer.Transporter {
  let pass: string | undefined;
  if (c.pass) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error('NEXTAUTH_SECRET is required to decrypt the SMTP password');
    pass = decrypt(c.pass, secret);
  }
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: !!c.secure,
    // Bound the time spent on a slow/unresponsive SMTP server so a request thread
    // (or the detached send task) cannot hang indefinitely.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    ...(c.user ? { auth: { user: c.user, pass } } : {}),
  });
}

/** Send an email using the SMTP settings. Throws if SMTP is not configured. */
export async function sendMail(settings: SettingsLike, { to, subject, html, text }: SendMailArgs): Promise<void> {
  if (!isSmtpConfigured(settings)) throw new Error('SMTP is not configured');
  const c = getSmtpConfig(settings);
  const transport = buildTransport(c);
  await transport.sendMail({ from: c.from, to, subject, html, text });
}

/** Send the password-reset email containing the one-time reset link. */
export async function sendPasswordResetEmail(settings: SettingsLike, to: string, resetUrl: string): Promise<void> {
  const subject = 'Reset your password';
  const text = [
    'You requested a password reset.',
    '',
    `Open this link to choose a new password (valid for 1 hour):`,
    resetUrl,
    '',
    'If you did not request this, you can safely ignore this email.',
  ].join('\n');
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#212934">
      <h2 style="margin:0 0 16px">Reset your password</h2>
      <p>You requested a password reset. Click the button below to choose a new password. This link is valid for <strong>1 hour</strong>.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="background:#6b459b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block">Reset password</a>
      </p>
      <p style="font-size:13px;color:#6c6d70">Or paste this link into your browser:<br><a href="${resetUrl}">${resetUrl}</a></p>
      <p style="font-size:13px;color:#6c6d70">If you did not request this, you can safely ignore this email.</p>
    </div>`;
  await sendMail(settings, { to, subject, html, text });
}

/** Send a test email so admins can verify their SMTP configuration. */
export async function sendTestEmail(settings: SettingsLike, to: string): Promise<void> {
  const subject = 'Test email';
  const text = 'This is a test email confirming your SMTP settings are working.';
  const html = `<div style="font-family:system-ui,sans-serif;color:#212934"><p>${text}</p></div>`;
  await sendMail(settings, { to, subject, html, text });
}
