export type StripeConnectErrorCode =
  | "stripe_connect_setup_required"
  | "stripe_credentials_invalid"
  | "stripe_permission_denied"
  | "stripe_country_rejected"
  | "stripe_request_rejected"
  | "stripe_temporarily_unavailable";

export function stripeRequestId(value: unknown): string | undefined {
  return typeof value === "string" && /^req_[A-Za-z0-9]{1,100}$/.test(value) ? value : undefined;
}

function safeToken(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9_.\[\]]{1,100}$/.test(value) ? value : undefined;
}

/** Keep only diagnostic identifiers, never the provider's raw message or payload. */
export class StripeRequestError extends Error {
  readonly code?: string;
  readonly type?: string;
  readonly param?: string;
  readonly requestId?: string;
  readonly publicCode: StripeConnectErrorCode;

  constructor(readonly status: number, payload: unknown, requestId: unknown) {
    super(`Stripe request failed (${status})`);
    this.name = "StripeRequestError";
    const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const error = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : {};
    this.code = safeToken(error.code);
    this.type = safeToken(error.type);
    this.param = safeToken(error.param);
    this.requestId = stripeRequestId(requestId);
    const message = typeof error.message === "string" ? error.message : "";
    if (/signed up for connect|sign up for connect|register your platform|connect (?:has not been|is not) enabled/i.test(message)) {
      this.publicCode = "stripe_connect_setup_required";
    } else if (status === 401 || this.code === "api_key_expired") {
      this.publicCode = "stripe_credentials_invalid";
    } else if (status === 403) {
      this.publicCode = "stripe_permission_denied";
    } else if (status === 429 || status >= 500) {
      this.publicCode = "stripe_temporarily_unavailable";
    } else if (this.param === "country" || this.code === "country_unsupported") {
      this.publicCode = "stripe_country_rejected";
    } else {
      this.publicCode = "stripe_request_rejected";
    }
  }

  diagnostics() {
    return { status: this.status, code: this.code, type: this.type, param: this.param,
      requestId: this.requestId, reason: this.publicCode };
  }
}

export function stripeConnectFailure(error: unknown) {
  const messages: Record<StripeConnectErrorCode, string> = {
    stripe_connect_setup_required: "Stripe Connect isn't enabled for CloseSync's Stripe account. The CloseSync owner needs to finish Connect setup in Stripe.",
    stripe_credentials_invalid: "CloseSync's Stripe test credentials need attention. Contact CloseSync support.",
    stripe_permission_denied: "CloseSync's Stripe connection doesn't have permission to set up accounts. Contact CloseSync support.",
    stripe_country_rejected: "Stripe couldn't set up an account in the selected country. Check your legal business country or contact CloseSync support.",
    stripe_request_rejected: "Stripe rejected account setup. Contact CloseSync support.",
    stripe_temporarily_unavailable: "Stripe is temporarily unavailable. Please wait a moment and retry.",
  };
  if (error instanceof StripeRequestError) {
    return { error: messages[error.publicCode], code: error.publicCode, requestId: error.requestId };
  }
  return { error: "Could not prepare the connected account. Please retry.", code: "connect_setup_failed" };
}
