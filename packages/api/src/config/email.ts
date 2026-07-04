import { SendEmailCommand } from "@aws-sdk/client-ses";
import { sesClient } from "./aws";
import { env } from "./env";

/**
 * Send an email via AWS SES. In local dev (no AWS creds / unverified domain)
 * this fails softly: it logs and resolves so signup/reset flows don't crash.
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string
): Promise<void> {
  try {
    await sesClient.send(
      new SendEmailCommand({
        Source: env.SES_FROM_ADDRESS,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject },
          Body: {
            Html: { Data: htmlBody },
            Text: { Data: textBody },
          },
        },
      })
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[email] send failed (${subject} → ${to}):`,
      (err as Error).message
    );
  }
}

const wrap = (title: string, inner: string) => `
<div style="background:#080808;color:#F4F4F4;font-family:Inter,Arial,sans-serif;padding:32px">
  <h1 style="font-family:Syne,Arial,sans-serif;text-transform:uppercase;color:#FF2D2D;letter-spacing:2px">APEX</h1>
  <h2 style="font-weight:600">${title}</h2>
  ${inner}
  <p style="color:rgba(255,255,255,0.28);font-size:12px;margin-top:32px">Apex Streaming Network</p>
</div>`;

export function welcomeEmail(displayName: string) {
  return {
    subject: "Welcome to Apex",
    html: wrap(
      `Welcome, ${displayName}`,
      `<p>Your account is live. Start watching live channels, VOD, and more.</p>`
    ),
    text: `Welcome to Apex, ${displayName}. Your account is live.`,
  };
}

export function verificationEmail(displayName: string, verifyUrl: string) {
  return {
    subject: "Verify your Apex email",
    html: wrap(
      `Confirm your email, ${displayName}`,
      `<p>Click to verify your account:</p>
       <p><a href="${verifyUrl}" style="color:#FF2D2D">${verifyUrl}</a></p>
       <p style="color:rgba(255,255,255,0.52)">Link expires in 24 hours.</p>`
    ),
    text: `Verify your Apex email: ${verifyUrl} (expires in 24h)`,
  };
}

export function passwordResetEmail(displayName: string, resetUrl: string) {
  return {
    subject: "Reset your Apex password",
    html: wrap(
      `Password reset`,
      `<p>Hi ${displayName}, reset your password:</p>
       <p><a href="${resetUrl}" style="color:#FF2D2D">${resetUrl}</a></p>
       <p style="color:rgba(255,255,255,0.52)">Link expires in 1 hour. Ignore if you didn't request it.</p>`
    ),
    text: `Reset your Apex password: ${resetUrl} (expires in 1h)`,
  };
}

export function payoutConfirmedEmail(displayName: string, amount: string) {
  return {
    subject: "Your Apex payout is on the way",
    html: wrap(
      `Payout confirmed`,
      `<p>Hi ${displayName}, your payout of <strong>${amount}</strong> has been initiated.</p>`
    ),
    text: `Apex payout of ${amount} initiated for ${displayName}.`,
  };
}
