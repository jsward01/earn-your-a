/** Minimal Resend client (https://resend.com/docs/api-reference/emails/send-email). */
import type { Email } from "./emailAlerts";

export const FROM = "Earn Your A <alerts@earnyoura.com>";

export type SendResult = { ok: true; id: string } | { ok: false; retryable: boolean; error: string };

export async function sendEmail(apiKey: string, to: string, email: Email, idempotencyKey: string): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Resend drops a repeat of the same key for 24h, so a run that sent but failed to record it can't double-send.
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ from: FROM, to: [to], subject: email.subject, text: email.text, html: email.html }),
    });
  } catch (e) {
    return { ok: false, retryable: true, error: e instanceof Error ? e.message : String(e) };
  }
  const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (res.ok && body?.id) return { ok: true, id: body.id };
  // 429 (rate limit) and 5xx are worth another try on the next run; anything else (bad address, bad key) is not.
  return { ok: false, retryable: res.status === 429 || res.status >= 500, error: `${res.status} ${body?.message ?? ""}`.trim() };
}
