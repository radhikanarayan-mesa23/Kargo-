import "server-only";
import { Resend } from "resend";

let client: Resend | null = null;

function getResendClient(): Resend {
  if (client) return client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  client = new Resend(apiKey);
  return client;
}

export interface SendEmailResult {
  ok: boolean;
  resendId?: string;
  error?: string;
}

/**
 * Dry-run by default (hard safety rule #2): unless EMAIL_MODE=live, every
 * send is redirected to TEST_RECIPIENT with the real intended recipient
 * shown in the subject line, so nothing ever reaches a real candidate by
 * accident.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ mode: "dry" | "live"; result: SendEmailResult }> {
  const isLive = process.env.EMAIL_MODE === "live";
  const from = process.env.RESEND_FROM;
  if (!from) throw new Error("RESEND_FROM is not set");

  const testRecipient = process.env.TEST_RECIPIENT;
  const to = isLive ? params.to : testRecipient;
  if (!isLive && !testRecipient) {
    return { mode: "dry", result: { ok: false, error: "TEST_RECIPIENT is not set" } };
  }

  const subject = isLive ? params.subject : `[to: ${params.to}] ${params.subject}`;

  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from,
      to: to!,
      subject,
      html: params.html,
    });
    if (error) {
      return { mode: isLive ? "live" : "dry", result: { ok: false, error: error.message } };
    }
    return {
      mode: isLive ? "live" : "dry",
      result: { ok: true, resendId: data?.id },
    };
  } catch (err) {
    return {
      mode: isLive ? "live" : "dry",
      result: { ok: false, error: (err as Error).message },
    };
  }
}
