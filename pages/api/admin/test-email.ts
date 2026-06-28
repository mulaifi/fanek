import type { NextApiResponse } from 'next';
import type { AuthenticatedRequest } from '@/types';
import { withAdmin, methodNotAllowed } from '@/lib/auth/guard';
import { getSettings } from '@/lib/settings';
import { isSmtpConfigured, sendTestEmail } from '@/lib/email';
import logger from '@/lib/logger';

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  const settings = await getSettings();
  if (!isSmtpConfigured(settings)) {
    res.status(400).json({ error: 'SMTP is not configured. Save your email settings first.' });
    return;
  }

  const { to } = (req.body ?? {}) as { to?: unknown };
  const recipient =
    typeof to === 'string' && to.trim() !== '' ? to.trim() : req.session.user.email;

  if (!recipient || typeof recipient !== 'string') {
    res.status(400).json({ error: 'No recipient email available' });
    return;
  }

  try {
    await sendTestEmail(settings, recipient);
    res.status(200).json({ success: true, sentTo: recipient });
  } catch (err) {
    logger.error({ err }, 'Test email failed');
    res.status(502).json({ error: 'Failed to send test email. Check your SMTP settings.' });
  }
}

export default withAdmin(handler);
