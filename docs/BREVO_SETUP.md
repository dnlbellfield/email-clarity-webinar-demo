# Brevo setup and activation handoff

## Target flow

```text
Public opt-in form
→ Netlify Function validation and abuse controls
→ Brevo temporary double-opt-in list
→ Email Clarity confirmation request
→ visitor clicks the confirmation link
→ Brevo confirmed-demo list
→ Demo 1 immediately
→ wait about 5 minutes
→ Demo 2
→ wait about 10 minutes
→ Demo 3 and Email Clarity project CTA
→ sequence ends
```

The campaign presents **A Practical Content System for Small Nonprofit Teams** as a free half-day online workshop on Thursday, November 12, 2026, from 11:00 a.m. to 2:30 p.m. Pacific. Its four connected sessions are led by fictional speakers Lena Ortiz, Maya Chen, Theo Brooks, and Amina Patel. The form requests the real three-email demonstration sequence; it does not register the visitor for an actual event.

The repository implements the request form, consent language, `inactive`, `test`, and `public` server modes, pending and confirmed pages, email previews, Turnstile integration, provider-aware duplicate protection, and safe event vocabulary. Brevo account resources still have to be created before controlled delivery can begin.

## 1. Approvals required first

Approve all of the following before the function is changed from `inactive`:

- The authenticated Email Clarity sending domain and sender address
- Physical sender information and reply-to address
- Privacy language and consent-version identifier
- Cloudflare Turnstile keys and the chosen server-side rate limit
- Demo-specific unsubscribe or preference behavior
- Pending-contact expiry and contact retention/deletion policy
- The production site URL and real Email Clarity inquiry URL
- The controlled test addresses

## 2. Authenticate the sending domain

In Brevo, open **Settings → Senders, Domains, IPs → Domains**, add the Email Clarity sending domain, and complete Brevo code, DKIM, and DMARC verification. Prefer Brevo's automatic authentication where available. Create a sender such as `Email Clarity <demo@your-domain>` only after the domain reports authenticated.

Do not use a free Gmail/Yahoo address or activate the automation before authentication and an inbox deliverability test.

## 3. Create isolated lists

Create a dedicated folder such as `Email Clarity – Commonlight Demo`, then create:

1. `Commonlight Demo – Pending DOI`
2. `Commonlight Demo – Confirmed`

Record both numeric list IDs. Neither list is a newsletter or project-inquiry list. The server adds new requests only to the pending list. The automation adds confirmed contacts to the confirmed list and removes them from pending.

## 4. Create minimal contact attributes

Use the standard `FIRSTNAME` attribute for the optional first name. Add:

- `DEMO_SEQ_CONSENT_AT` — text containing an ISO-8601 server timestamp
- `DEMO_SEQ_CONSENT_VERSION` — text such as `commonlight-demo-v1`
- `DEMO_SEQ_SOURCE` — text fixed to `commonlight-public`
- `DEMO_SEQ_STATUS` — category or text: `pending`, `confirmed`, `complete`, `expired`, `unsubscribed`

The visitor does not enter these values; the server and automation set them. Do not add organization, role, free text, or analytics identifiers.

## 5. Create the email templates

Create one Email Clarity double-opt-in template and three Commonlight sequence templates using the HTML/plain-text artifacts in `site/emails/`:

1. `Confirm your Commonlight demo sequence` — sender Email Clarity; link the CTA to the absolute production `/sequence-confirmed.html?confirmation=brevo` URL.
2. `[Demo 1/3] Your workshop details: A Practical Content System`
3. `[Demo 2/3] Reminder: A Practical Content System`
4. `[Demo 3/3] Your Commonlight content-planning recap`

The double-opt-in email is not one of the three sequence messages. Replace all relative image and CTA URLs with absolute production URLs. Replace the final project's local case-study link with the approved Email Clarity inquiry URL.

Every sequence message must identify its position, explain the fictional demonstration context, contain required sender information, and include Brevo's `{{ unsubscribe }}` link. Configure a demo-specific preference/unsubscribe experience where the account plan permits it.

## 6. Build one Brevo automation

Create an automation from scratch:

1. Trigger: **Contact added to list** → `Commonlight Demo – Pending DOI`.
2. Send the Email Clarity double-opt-in template.
3. **Wait until an event happens** → `Link clicked in an email`; filter the link URL using **Contains** with `/sequence-confirmed.html?confirmation=brevo`. Set a 24-hour timeout. This Brevo link-click step is the authoritative confirmation record; the browser event is only a PII-free page-arrival signal.
4. Yes branch:
   - Add contact to `Commonlight Demo – Confirmed`.
   - Remove contact from `Commonlight Demo – Pending DOI`.
   - Set `DEMO_SEQ_STATUS=confirmed`.
   - Send Demo 1 immediately.
   - Wait approximately 5 minutes; send Demo 2.
   - Wait approximately 10 minutes; send Demo 3.
   - Set `DEMO_SEQ_STATUS=complete`; end.
5. No branch:
   - Remove contact from the pending list.
   - Set `DEMO_SEQ_STATUS=expired`; end.

Allow re-entry after exit so someone can intentionally request the sequence again. Do not globally unblock existing contacts. Do not automatically delete or globally blocklist a contact who might belong to another legitimate list; apply the approved retention policy only to the demo-list membership and demo-only contacts.

## 7. Server API handoff

After approval, the Netlify Function will:

1. Require `POST`, JSON, an 8 KB maximum body, an exact allowed `Origin`, valid email syntax, optional first name length, and `consent === true`.
2. Verify every `test` and `public` submission with Cloudflare Turnstile server-side, including its action and hostname. Tokens are never accepted based only on browser validation.
3. Apply Netlify's platform rate limit of five function requests per IP per 60 seconds.
4. Look up the contact before writing. Do not retrigger contacts already in the pending or confirmed demo lists, never unblock an unsubscribed contact, and enforce a minimum 24-hour re-entry interval in public mode.
5. Call `POST https://api.brevo.com/v3/contacts` with the API key in the server-only `api-key` header.
6. Send only `email`, optional `FIRSTNAME`, fixed consent metadata, `listIds: [BREVO_TEMP_LIST_ID]`, and `updateEnabled: true`.
7. Never un-blocklist a contact, alter unrelated list memberships, log contact values, return contact values, or expose the API key.
8. Return a generic pending-confirmation response and redirect to `/confirmation.html`.

## 8. Environment variables

Set these locally in ignored `.env` files and in Netlify environment variables. Never paste real values into source control, browser code, analytics, or chat.

```dotenv
DEMO_SEQUENCE_MODE=inactive
PUBLIC_SITE_URL=https://your-demo-domain.example
DEMO_SEQUENCE_CONFIRM_URL=https://your-demo-domain.example/sequence-confirmed.html?confirmation=brevo
DEMO_SEQUENCE_CONSENT_VERSION=commonlight-demo-v1
DEMO_SEQUENCE_ALLOWED_ORIGINS=https://your-demo-domain.example
DEMO_SEQUENCE_REENTRY_HOURS=24

BREVO_API_KEY=secret
BREVO_TEMP_LIST_ID=123456
BREVO_CONFIRMED_LIST_ID=123457
DEMO_SEQUENCE_TEST_EMAILS=owner@example.com

TURNSTILE_SITE_KEY=public-site-key
TURNSTILE_SECRET_KEY=secret
TURNSTILE_ALLOWED_HOSTNAMES=your-demo-domain.example
EMAIL_CLARITY_INQUIRY_URL=https://your-email-clarity-site.example/contact
```

Mode progression:

- `inactive`: validate locally; never call Brevo.
- `test`: call Brevo only for exact addresses in `DEMO_SEQUENCE_TEST_EMAILS`.
- `public`: accept valid public double-opt-in requests after every activation prerequisite passes.

## 9. Staged verification

1. Keep `inactive`; verify validation, required consent, no network handoff, and no PII in `dataLayer`.
2. Authenticate the sender and create lists, attributes, templates, and the inactive automation.
3. Set `test`; use only owner-controlled addresses. Verify temporary-list entry and the DOI email.
4. Click the DOI link. Verify confirmed-list entry, pending-list removal, Demo 1, the 5-minute wait, Demo 2, the 10-minute wait, and Demo 3.
5. Verify unsubscribe stops the remaining sequence and does not subscribe the contact elsewhere.
6. Verify non-confirmers expire, duplicates/re-entry behave as documented, other list memberships remain intact, and no contact data enters logs or analytics.
7. Verify sender details, mobile/desktop rendering, plain text, links, spam-folder behavior, and the final project-inquiry CTA.
8. Only after recorded approval, set `public` and deploy. Then repeat the full journey with a fresh external address.

## Official references

- [Brevo: Double opt-in for a form created outside Brevo](https://help.brevo.com/hc/en-us/articles/27353832123026-Set-up-a-double-opt-in-process-for-a-sign-up-form-created-outside-of-Brevo)
- [Brevo: Create a contact API](https://developers.brevo.com/reference/create-contact)
- [Brevo: Authenticate a sending domain](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC)
- [Brevo: Unsubscribe-link requirements](https://help.brevo.com/hc/en-us/articles/9741388688402-Do-I-need-to-add-an-unsubscribe-link-to-my-emails)
