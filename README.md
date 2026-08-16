# Email Clarity webinar demo

A small static webinar campaign showing how promotional email, registration, a protected Brevo automation path, safe local dataLayer events, accessibility, and QA connect.

Commonlight Studio, Lena Ortiz, and the event are fictional. This is not client work and no performance results are claimed.

## Run locally

```bash
npm install
npm run build
npm run preview
```

Open `http://localhost:8080`. Static preview mode works without credentials. Netlify Functions require `netlify dev` or a Netlify deploy; plain static preview safely falls back to simulated registration.

## Local routes

- `/case-study.html` — primary portfolio entry, transparent project disclosure, implementation details, and testing status
- `/` — Commonlight Studio attendee experience: webinar landing page and registration form
- `/confirmation.html` — campaign confirmation state
- `/email-previews.html` — four email previews inside the Email Clarity portfolio wrapper

## Checks

```bash
npm run build
npm run check
```

The build copies an explicit file allowlist into `dist/`. The check verifies that exact list and scans it for obvious Brevo secrets.

## Controlled test mode

Copy `.env.example` to a local ignored `.env` and set:

- `DEMO_MODE=test`
- `BREVO_API_KEY`
- `BREVO_LIST_ID`
- `DEMO_ALLOWED_EMAILS` as a comma-separated exact allowlist

The Brevo list should be dedicated to this demo. Configure standard `FIRSTNAME` plus one optional text attribute named `ORGANIZATION`. Entry into that list is the trigger for one automation containing confirmation, reminder, and follow-up messages.

Do not enable test mode until the list, attribute, automation timing, and test addresses have been reviewed. Do not put secrets or the address allowlist into HTML, client JavaScript, GTM, or GA4.

## Local tracking events

The vertical slice pushes fixed, non-identifying events into `window.dataLayer` for local inspection. It does not load GTM, GA4, or any other analytics service. External analytics configuration is deliberately deferred.

Never map form fields, DOM values, query strings containing registration data, or arbitrary URLs into analytics. Do not create `generate_lead` or the production Email Clarity `inquiry_success` event. Any later external analytics connection requires separate approval and a consent review.

## External configuration status

- Brevo resources: not configured
- GTM container: not configured
- GA4 property/data stream: not configured
- Netlify site/deployment: not configured

Each requires explicit approval before setup or deployment.
