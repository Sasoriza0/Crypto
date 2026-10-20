import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Production mail service (Nodemailer).
 *
 * Configuration comes entirely from env (see .env.example):
 *  - SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS / MAIL_FROM
 *
 * When SMTP_HOST is missing (local dev), the transport falls back to
 * jsonTransport and the composed letter is dumped to the console instead —
 * the full compose path still runs, so template bugs surface in dev.
 */

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export function mailFrom(): string {
  return process.env.MAIL_FROM ?? 'ShiftCrack Security <noreply@shiftcrack.local>';
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  if (smtpConfigured()) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

/** Reset the cached transport (tests). */
export function resetMailTransport(): void {
  transporter = null;
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ResetEmailInput {
  to: string;
  nickname: string | null;
  resetUrl: string;
  ttlMinutes: number;
}

/**
 * Styled HTML letter in the "ShiftCrack Security Protocol" dossier
 * aesthetic: dark telegram card, red SECURITY PROTOCOL stamp, mono copy,
 * one-shot reset link. Inline CSS only — email clients strip <style>.
 */
export function buildResetEmail({ to, nickname, resetUrl, ttlMinutes }: ResetEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = 'ShiftCrack Security Protocol — access recovery';
  const text =
    [
      'SHIFTCRACK SECURITY PROTOCOL',
      'File 047-B // Password recovery',
      '',
      `Operator: ${nickname ?? to}`,
      '',
      'A password reset has been requested for this address. The link below is valid for one use and expires automatically.',
      '',
      resetUrl,
      '',
      `The link is valid for ${ttlMinutes} minutes. If you did not request it, ignore this letter — your access remains unchanged.`,
    ].join('\n');

  const html = `
<!doctype html>
<html>
<body style="margin:0;padding:0;background-color:#1c1917;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1c1917;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border:2px solid #44403c;background-color:#f5f1e8;font-family:Consolas,Monaco,'Courier New',monospace;color:#1c1917;">
          <tr>
            <td style="padding:20px 24px 8px;border-bottom:1px solid #a8a29e;">
              <span style="display:inline-block;border:2px solid #b91c1c;color:#b91c1c;padding:4px 10px;font-size:10px;font-weight:bold;letter-spacing:3px;">SECURITY PROTOCOL // FILE 047-B</span>
              <h1 style="margin:16px 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:1px;text-transform:uppercase;">Access recovery</h1>
              <p style="margin:0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#57534e;">ShiftCrack // Sector 9 // Operator authorization</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;font-size:13px;line-height:1.7;">
              <p style="margin:0 0 12px;">OPERATOR <strong>${esc(nickname ?? to)}</strong>,</p>
              <p style="margin:0 0 12px;">A password reset has been requested for this address. The link below is single-use and expires automatically after ${ttlMinutes} minutes.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto;">
                <tr>
                  <td style="border:2px solid #1c1917;background-color:#1c1917;">
                    <a href="${esc(resetUrl)}" style="display:inline-block;padding:14px 28px;color:#f5f1e8;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">Reset access code</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;font-size:11px;color:#57534e;">If the button does not open, copy this link into the terminal (browser):</p>
              <p style="margin:0 0 12px;font-size:11px;word-break:break-all;color:#b91c1c;">${esc(resetUrl)}</p>
              <p style="margin:0;padding:10px 12px;border-left:4px solid #b91c1c;background-color:#e7e0d0;font-size:11px;color:#44403c;">
                If you did not request this letter — ignore it. Your access remains unchanged and the link will expire by itself.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 24px;border-top:1px solid #a8a29e;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#57534e;">
              ShiftCrack Security Protocol &middot; Section 9 &middot; Eyes only
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return { subject, text, html };
}

/**
 * Deliver the reset letter. With SMTP configured this sends for real;
 * without it the letter is printed to the console so the local dev flow
 * still exposes the reset link.
 */
export async function sendResetEmail(input: ResetEmailInput): Promise<void> {
  const { subject, text, html } = buildResetEmail(input);
  const mail = { from: mailFrom(), to: input.to, subject, text, html };

  if (!smtpConfigured()) {
    const info = await getTransporter().sendMail(mail);
    console.log(
      `[mail] SMTP not configured — password reset letter for ${input.to} printed below instead of being sent.`,
    );
    console.log(info.message);
    return;
  }

  await getTransporter().sendMail(mail);
}
