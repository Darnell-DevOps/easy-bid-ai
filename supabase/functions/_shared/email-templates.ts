// Premium minimal transactional email templates for CloseSync AI / CloseSync.
// Pure HTML strings — no React Email dependency. Each template returns
// { subject, html, text } given a small data bag.

export type EmailData = Record<string, string | number | undefined | null>;

const BRAND = "CloseSync AI";
const APP_URL = "https://app.closesync.io";

function layout(opts: { preheader: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${BRAND}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0a0a0a;">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escape(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f7;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
      <tr><td style="padding:32px 40px 0;">
        <div style="font-size:15px;font-weight:600;letter-spacing:-0.01em;color:#0a0a0a;">${BRAND}</div>
      </td></tr>
      <tr><td style="padding:24px 40px 40px;">
        ${opts.bodyHtml}
      </td></tr>
      <tr><td style="padding:24px 40px 32px;border-top:1px solid #eeeeee;">
        <div style="font-size:12px;color:#8a8a8e;line-height:1.6;">
          You received this from ${BRAND} because of activity on your account.<br/>
          <a href="${APP_URL}" style="color:#8a8a8e;text-decoration:underline;">${APP_URL.replace("https://", "")}</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function button(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td style="background:#0a0a0a;border-radius:10px;">
<a href="${escape(url)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.01em;">${escape(label)}</a>
</td></tr></table>`;
}

function escape(s: string | number | undefined | null): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function p(text: string) {
  return `<p style="font-size:15px;line-height:1.6;color:#1a1a1a;margin:0 0 16px;">${text}</p>`;
}
function h1(text: string) {
  return `<h1 style="font-size:22px;font-weight:600;letter-spacing:-0.02em;color:#0a0a0a;margin:0 0 16px;">${escape(text)}</h1>`;
}

type Tpl = (d: EmailData) => { subject: string; html: string; text: string };

const templates: Record<string, Tpl> = {
  welcome: (d) => {
    const name = escape(d.name || "there");
    const subject = `Welcome to ${BRAND}`;
    const body =
      h1(`Welcome, ${name}`) +
      p(`Your workspace is ready. ${BRAND} helps you send proposals, sign contracts, and recover lost revenue — without the busywork.`) +
      p(`The fastest path to value: send your first proposal.`) +
      button(`${APP_URL}/proposals/new`, "Create your first proposal");
    return {
      subject,
      html: layout({ preheader: "Your workspace is ready.", bodyHtml: body }),
      text: `Welcome, ${name}\n\nYour workspace is ready. Get started: ${APP_URL}/proposals/new`,
    };
  },

  "proposal-sent": (d) => {
    const subject = `${escape(d.from_name || "A proposal")} sent you a proposal`;
    const body =
      h1(`You have a new proposal`) +
      p(`${escape(d.from_name || "Your contact")} just sent you a proposal${d.title ? ` — <strong>${escape(d.title)}</strong>` : ""}.`) +
      (d.amount ? p(`Total: <strong>${escape(d.amount)}</strong>`) : "") +
      button(String(d.url || APP_URL), "Review proposal");
    return {
      subject,
      html: layout({ preheader: "Review the proposal in your browser.", bodyHtml: body }),
      text: `${d.from_name || "Your contact"} sent you a proposal. Review: ${d.url || APP_URL}`,
    };
  },

  "contract-signature-reminder": (d) => {
    const subject = `Action needed: sign your contract`;
    const body =
      h1(`Your contract is ready to sign`) +
      p(`${escape(d.from_name || "Your contact")} has prepared a contract for you${d.title ? ` — <strong>${escape(d.title)}</strong>` : ""}. It only takes a minute.`) +
      button(String(d.url || APP_URL), "Review and sign");
    return {
      subject,
      html: layout({ preheader: "Sign your contract in under a minute.", bodyHtml: body }),
      text: `Your contract is ready to sign: ${d.url || APP_URL}`,
    };
  },

  "payment-confirmation": (d) => {
    const subject = `Payment received${d.amount ? ` — ${d.amount}` : ""}`;
    const body =
      h1(`Payment received`) +
      p(`Thank you${d.name ? `, ${escape(d.name)}` : ""}. We have received your payment${d.amount ? ` of <strong>${escape(d.amount)}</strong>` : ""}${d.description ? ` for <strong>${escape(d.description)}</strong>` : ""}.`) +
      (d.url ? button(String(d.url), "View receipt") : "");
    return {
      subject,
      html: layout({ preheader: "Your payment was successful.", bodyHtml: body }),
      text: `Payment received${d.amount ? ` — ${d.amount}` : ""}. Thank you.`,
    };
  },

  "payment-failed": (d) => {
    const isFinal = d.severity === "final";
    const subject = isFinal
      ? `Final notice: payment failed for ${escape(d.client_name || "your retainer")}`
      : `Payment failed for ${escape(d.client_name || "your retainer")}`;
    const body =
      h1(isFinal ? "Final payment attempt failed" : "A retainer payment failed") +
      p(`The recurring charge for <strong>${escape(d.client_name || "your retainer")}</strong>${d.amount ? ` (${escape(d.amount)})` : ""} was declined${d.reason ? ` — <em>${escape(d.reason)}</em>` : ""}.`) +
      p(isFinal
        ? `This was the last automatic retry. Update payment details to keep the retainer active.`
        : `We will retry automatically, but updating the payment method now is the fastest fix.`) +
      button(String(d.url || `${APP_URL}/recovery`), "Open recovery center");
    return {
      subject,
      html: layout({ preheader: "A retainer charge failed — quick action recommended.", bodyHtml: body }),
      text: `Retainer payment failed for ${d.client_name || ""}. ${d.url || APP_URL}/recovery`,
    };
  },

  "renewal-reminder": (d) => {
    const days = Number(d.days_until || 0);
    const subject = `Retainer renews in ${days} days — ${escape(d.client_name || "")}`;
    const body =
      h1(`Renewal in ${days} days`) +
      p(`Your retainer with <strong>${escape(d.client_name || "this client")}</strong> ends on <strong>${escape(d.end_date || "")}</strong>.`) +
      p(days <= 7
        ? `If you want to continue, confirm renewal terms with the client this week.`
        : `Plenty of runway — but a quick check-in now makes renewal a formality.`) +
      button(String(d.url || `${APP_URL}/retainers`), "Open retainer");
    return {
      subject,
      html: layout({ preheader: `Retainer renews in ${days} days.`, bodyHtml: body }),
      text: `Retainer with ${d.client_name || ""} renews in ${days} days. ${d.url || APP_URL}/retainers`,
    };
  },

  "retainer-notification": (d) => {
    const subject = String(d.subject || `Update on your retainer`);
    const body =
      h1(String(d.heading || "Retainer update")) +
      p(escape(d.message || "")) +
      (d.url ? button(String(d.url), String(d.cta || "Open in CloseSync")) : "");
    return {
      subject,
      html: layout({ preheader: String(d.preheader || subject), bodyHtml: body }),
      text: `${subject}\n\n${d.message || ""}`,
    };
  },

  "booking-confirmation": (d) => {
    const subject = `Booking confirmed${d.when ? ` — ${d.when}` : ""}`;
    const body =
      h1(`You're booked in`) +
      p(`${d.name ? `Hi ${escape(d.name)}, ` : ""}your ${escape(d.title || "session")} is confirmed${d.when ? ` for <strong>${escape(d.when)}</strong>` : ""}.`) +
      (d.meeting_url
        ? p(`<strong>Join link:</strong> <a href="${escape(d.meeting_url)}" style="color:#0a0a0a;text-decoration:underline;word-break:break-all;">${escape(d.meeting_url)}</a>`) + button(String(d.meeting_url), "Join meeting")
        : (d.location ? p(`Location: ${escape(d.location)}`) : "")) +
      (d.reschedule_url
        ? p(`Need a different time? <a href="${escape(d.reschedule_url)}" style="color:#0a0a0a;text-decoration:underline;">Reschedule</a>.`)
        : "");
    return {
      subject,
      html: layout({ preheader: "Your booking is confirmed.", bodyHtml: body }),
      text: `Booking confirmed${d.when ? ` for ${d.when}` : ""}.${d.meeting_url ? `\nJoin: ${d.meeting_url}` : ""}${d.reschedule_url ? `\nReschedule: ${d.reschedule_url}` : ""}`,
    };
  },

  "booking-host-notification": (d) => {
    const subject = `New meeting: ${escape(d.title || "meeting")}${d.when ? ` — ${escape(d.when)}` : ""}`;
    const body =
      h1(`New meeting on your calendar`) +
      p(`<strong>${escape(d.client_name || "A client")}</strong> is booked${d.when ? ` for <strong>${escape(d.when)}</strong>` : ""}.`) +
      (d.client_email ? p(`Email: <a href="mailto:${escape(d.client_email)}" style="color:#0a0a0a;">${escape(d.client_email)}</a>`) : "") +
      (d.meeting_url
        ? p(`<strong>Join link:</strong> <a href="${escape(d.meeting_url)}" style="color:#0a0a0a;text-decoration:underline;word-break:break-all;">${escape(d.meeting_url)}</a>`) + button(String(d.meeting_url), "Join meeting")
        : (d.location ? p(`Location: ${escape(d.location)}`) : "")) +
      (d.client_message ? p(`<em>"${escape(d.client_message)}"</em>`) : "") +
      p(`The calendar invite is attached — open it to add this to your email's calendar.`);
    return {
      subject,
      html: layout({ preheader: "A new meeting was just scheduled.", bodyHtml: body }),
      text: `New meeting with ${d.client_name || ""}${d.when ? ` on ${d.when}` : ""}.${d.meeting_url ? `\nJoin: ${d.meeting_url}` : ""}`,
    };
  },

  "booking-reminder": (d) => {
    const subject = `Reminder: ${escape(d.title || "your meeting")} tomorrow${d.when ? ` at ${escape(d.when)}` : ""}`;
    const body =
      h1(`See you soon`) +
      p(`${d.name ? `Hi ${escape(d.name)}, ` : ""}this is a friendly reminder about your upcoming ${escape(d.title || "meeting")}${d.when ? ` on <strong>${escape(d.when)}</strong>` : ""}.`) +
      (d.meeting_url
        ? p(`<strong>Join link:</strong> <a href="${escape(d.meeting_url)}" style="color:#0a0a0a;text-decoration:underline;word-break:break-all;">${escape(d.meeting_url)}</a>`) + button(String(d.meeting_url), "Join meeting")
        : (d.location ? p(`Location: ${escape(d.location)}`) : "")) +
      (d.reschedule_url
        ? p(`Can't make it? <a href="${escape(d.reschedule_url)}" style="color:#0a0a0a;text-decoration:underline;">Reschedule</a>.`)
        : "");
    return {
      subject,
      html: layout({ preheader: "Quick reminder about your upcoming meeting.", bodyHtml: body }),
      text: `Reminder: ${d.title || "meeting"}${d.when ? ` at ${d.when}` : ""}.${d.meeting_url ? `\nJoin: ${d.meeting_url}` : ""}${d.reschedule_url ? `\nReschedule: ${d.reschedule_url}` : ""}`,
    };
  },

  "follow-up-reminder": (d) => {
    const subject = `Follow up with ${escape(d.client_name || "your client")}`;
    const body =
      h1(`Time to follow up`) +
      p(`Your scheduled follow-up with <strong>${escape(d.client_name || "this client")}</strong> is due${d.context ? ` — <em>${escape(d.context)}</em>` : ""}.`) +
      button(String(d.url || `${APP_URL}/proposals`), "Open proposal");
    return {
      subject,
      html: layout({ preheader: "Scheduled follow-up due.", bodyHtml: body }),
      text: `Follow up with ${d.client_name || ""}: ${d.url || APP_URL}/proposals`,
    };
  },

  "review-request": (d) => {
    const fromName = escape(d.from_name || "We");
    const subject = `${d.from_name ? escape(d.from_name) + " would" : "We would"} love your feedback`;
    const body =
      h1(`Could you share a quick review?`) +
      p(`Hi ${escape(d.client_name || "")},`) +
      p(`${fromName} hope${d.from_name ? "s" : ""} the work landed well. A short review — even one sentence — would mean a lot and helps future clients trust the process.`) +
      (d.custom_message ? p(escape(d.custom_message)) : "") +
      button(String(d.url || APP_URL), "Leave a review (1 min)") +
      (d.google_review_url ? p(`Prefer Google? <a href="${escape(d.google_review_url)}" style="color:#0a0a0a;">Leave a Google review</a>.`) : "");
    return {
      subject,
      html: layout({ preheader: "A quick review would mean a lot.", bodyHtml: body }),
      text: `Hi ${d.client_name || ""}, could you share a quick review? ${d.url || APP_URL}`,
    };
  },

  "review-reminder": (d) => {
    const subject = `A small nudge — your review${d.from_name ? ` for ${escape(d.from_name)}` : ""}`;
    const body =
      h1(`Just a gentle reminder`) +
      p(`Hi ${escape(d.client_name || "")}, no pressure at all — just floating this back to the top of your inbox in case it slipped past.`) +
      p(`A quick sentence about your experience would genuinely help.`) +
      button(String(d.url || APP_URL), "Leave a review") +
      (d.google_review_url ? p(`Or share on <a href="${escape(d.google_review_url)}" style="color:#0a0a0a;">Google</a>.`) : "");
    return {
      subject,
      html: layout({ preheader: "Quick reminder about your review.", bodyHtml: body }),
      text: `Reminder — your review: ${d.url || APP_URL}`,
    };
  },
};

export function renderTemplate(name: string, data: EmailData) {
  const tpl = templates[name];
  if (!tpl) throw new Error(`Unknown template: ${name}`);
  return tpl(data);
}

export function listTemplates(): string[] {
  return Object.keys(templates);
}
