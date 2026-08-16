# Email Clarity online-event demo

A small static campaign for a fictional free half-day online workshop, showing how promotional email, a real sequence request, a protected Brevo automation path, safe local dataLayer events, accessibility, and QA connect.

Commonlight Studio, its presenters, and the event are fictional. This is not client work and no performance results are claimed.

## Run locally

```bash
npm install
npm run build
npm run preview
```

Open `http://localhost:8080`. Static preview mode works without credentials. The public inbox sequence is intentionally inactive until the Brevo and safety checklist is approved.

## Local routes

- `/case-study.html` — primary portfolio entry, transparent project disclosure, implementation details, and testing status
- `/` — Commonlight Studio campaign and explicit demo-sequence opt-in
- `/confirmation.html` — pending double-opt-in state
- `/sequence-confirmed.html` — reserved destination after confirmed opt-in
- `/email-previews.html` — double-opt-in and campaign email previews

## Checks

```bash
npm run build
npm run check
```

The build copies an explicit file allowlist into `dist/`. The check verifies that exact list and scans it for obvious Brevo secrets.

## Brevo activation

See [docs/BREVO_SETUP.md](docs/BREVO_SETUP.md) for the exact lists, attributes, automation, environment variables, abuse controls, and staged test plan. The current function validates the future request contract but deliberately does not store contacts or call Brevo. Real integration work begins only after that setup is approved.

## Local tracking events

The vertical slice pushes fixed, non-identifying events into `window.dataLayer` for local inspection. It does not load GTM, GA4, or any other analytics service. External analytics configuration is deliberately deferred.

Never map form fields, DOM values, query strings containing registration data, or arbitrary URLs into analytics. Do not create `generate_lead` or the production Email Clarity `inquiry_success` event. Any later external analytics connection requires separate approval and a consent review.

## External configuration status

- Brevo resources: not configured
- GTM container: not configured
- GA4 property/data stream: not configured
- Netlify site/deployment: not configured

Each requires explicit approval before setup or deployment.
