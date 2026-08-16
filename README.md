# Email Clarity webinar demonstration

A fictional, static webinar campaign showing how promotional email, registration, protected Brevo automation, consent-aware analytics, accessibility, and QA connect.

Commonlight Studio, Lena Ortiz, and the event are fictional. This is not client work and no performance results are claimed.

## Run locally

```bash
npm install
npm run build
npm run preview
```

Open `http://localhost:8080`. Static preview mode works without credentials. Netlify Functions require `netlify dev` or a Netlify deploy; plain static preview safely falls back to simulated registration.

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

## Analytics configuration

No GTM or GA4 identifiers are configured. After approval, add the separate demo GTM container ID to the `demo-gtm-id` meta value during the deploy configuration process. GA4 tags must require granted analytics consent and must use only the fixed parameters documented on `tracking.html`.

Never map form fields, DOM values, query strings containing registration data, or arbitrary URLs into analytics. Do not create `generate_lead` or the production Email Clarity `inquiry_success` event.

## External configuration status

- Brevo resources: not configured
- GTM container: not configured
- GA4 property/data stream: not configured
- Netlify site/deployment: not configured

Each requires explicit approval before setup or deployment.
