export interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  /** Only for "Send test email"; the alerts Worker has its own copy. Unset = that button reports it isn't set up. */
  RESEND_API_KEY?: string;
}
