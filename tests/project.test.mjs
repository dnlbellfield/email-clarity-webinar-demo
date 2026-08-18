import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const pages = (await readdir("site")).filter((name) => name.endsWith(".html"));

test("every public page has a title and viewport", async () => {
  for (const page of pages) {
    const html = await readFile(`site/${page}`, "utf8");
    assert.match(html, /<title>[^<]+<\/title>/, page);
    assert.match(html, /name="viewport"/, page);
  }
});

test("demo sequence fields have explicit labels and no analytics PII interpolation", async () => {
  const html = await readFile("site/register.html", "utf8");
  for (const id of ["firstName", "email", "sequenceConsent"]) assert.match(html, new RegExp(`for="${id}"`));
  const js = await readFile("site/assets/app.js", "utf8");
  const trackCalls = [...js.matchAll(/track\([^;]+/g)].map((match) => match[0]).join("\n");
  assert.doesNotMatch(trackCalls, /\.value|firstName|email_address/);
  assert.doesNotMatch(js, /generate_lead|inquiry_success/);
  assert.doesNotMatch(js, /demo_registration_/);
});

test("portfolio layers contain clear disclosure", async () => {
  const caseStudy = await readFile("site/index.html", "utf8");
  assert.match(caseStudy, /Portfolio example:/i);
  assert.match(caseStudy, /created to simulate a complete online-event campaign/i);
  assert.match(caseStudy, /not client work/i);
  assert.match(caseStudy, /does not report real-world results/i);
  assert.match(await readFile("site/email-previews.html", "utf8"), /Portfolio example:/);
});

test("campaign landing has a minimal explicit demo-sequence opt-in", async () => {
  const html = await readFile("site/register.html", "utf8");
  assert.doesNotMatch(html, /name="organization"|name="role"/i);
  assert.match(html, /name="email"[^>]+required/);
  assert.match(html, /name="firstName"/);
  assert.match(html, /name="sequenceConsent"[^>]+required/);
  assert.doesNotMatch(html, /name="sequenceConsent"[^>]+checked/);
  assert.match(html, /three-email Commonlight demonstration sequence/i);
  assert.match(html, /This does not register you for a live event/i);
  assert.match(html, /Receive the three-email sequence/i);
  assert.match(html, /unsubscribe at any time/i);
  assert.match(html, /not be added to a general marketing list/i);
  assert.match(html, /shell grid gap-12[^\"]*lg:grid-cols-\[1fr_\.82fr\]/);
  assert.match(html, /11 a\.m\.–2:30 p\.m\. PT/);
  for (const speaker of ["Lena Ortiz", "Maya Chen", "Theo Brooks", "Amina Patel"]) {
    assert.match(html, new RegExp(speaker));
  }
  for (const image of ["conference-group-front.jpg", "ortiz_conf.jpeg", "conference-group.jpg"]) {
    assert.match(html, new RegExp(image));
  }
});

test("opt-in journey pages contain only user-facing next-step language", async () => {
  const sources = [
    "site/register.html",
    "site/confirmation.html",
    "site/sequence-confirmed.html",
    "site/assets/app.js"
  ];
  const combined = (await Promise.all(sources.map((source) => readFile(source, "utf8")))).join("\n");
  assert.doesNotMatch(combined, /When public delivery is activated|Live sequence:|Controlled test:|Current local status:|local request was validated|reserved for the approved Brevo confirmation link/i);

  const confirmation = await readFile("site/confirmation.html", "utf8");
  assert.match(confirmation, /Check your inbox/i);
  assert.match(confirmation, /Click it to begin the three-email Commonlight sequence/i);

  const sequenceConfirmed = await readFile("site/sequence-confirmed.html", "utf8");
  assert.match(sequenceConfirmed, /The first Commonlight message should arrive shortly/i);
});

test("the locked workshop definition is consistent across campaign sources", async () => {
  const sources = [
    "site/register.html",
    "site/index.html",
    "site/emails/promotional.html",
    "site/emails/confirmation.html",
    "site/emails/reminder.html",
    "docs/CAMPAIGN_BRIEF.md",
    "docs/BREVO_SETUP.md"
  ];
  const combined = (await Promise.all(sources.map((source) => readFile(source, "utf8"))))
    .join("\n")
    .replaceAll(/https?:\/\/[^\s\"'<>]+/g, "");
  assert.doesNotMatch(combined, /45.minute|single presenter|\bwebinar\b/i);
  for (const phrase of [
    "How Small Nonprofit Teams Can Build a Better Content Workflow",
    "free half-day online workshop",
    "Thursday, November 12, 2026",
    "11:00 a.m.–2:30 p.m. Pacific",
    "four connected sessions",
    "Lena Ortiz",
    "Maya Chen",
    "Theo Brooks",
    "Amina Patel"
  ]) assert.match(combined, new RegExp(phrase, "i"));
});

test("navigation preserves the campaign and portfolio hierarchy", async () => {
  const caseStudy = await readFile("site/index.html", "utf8");
  const campaign = await readFile("site/register.html", "utf8");
  const emails = await readFile("site/email-previews.html", "utf8");
  assert.match(caseStudy, /href="\/"[^>]*>See the sign-up experience/);
  assert.match(caseStudy, /href="\/email-previews\.html">Preview the emails/);
  assert.doesNotMatch(caseStudy, /href="\/confirmation\.html"/);
  assert.doesNotMatch(campaign, /href="\/email-previews\.html"/);
  assert.match(campaign, /href="\/case-study\.html">View the Email Clarity project case study/);
  assert.match(emails, /href="\/case-study\.html">Back to the case study/);
});

test("inbox sequence is explicitly labeled and unsubscribable", async () => {
  const doubleOptIn = await readFile("site/emails/double-opt-in.html", "utf8");
  assert.match(doubleOptIn, /Confirm your Commonlight demo sequence/i);
  for (const [page, position] of [["confirmation.html", "1"], ["reminder.html", "2"], ["follow-up.html", "3"]]) {
    const html = await readFile(`site/emails/${page}`, "utf8");
    assert.match(html, new RegExp(`Demo ${position} of 3`, "i"), page);
    assert.match(html, /not real/i, page);
    assert.match(html, /\{\{ unsubscribe \}\}/, page);
  }
});

test("public email journey excludes the archival invitation and plain-text files", async () => {
  const html = await readFile("site/email-previews.html", "utf8");
  const build = await readFile("scripts/build.mjs", "utf8");
  assert.match(html, /Four emails that take readers from confirmation to follow-up/);
  assert.match(html, /Workshop details and program/);
  assert.match(html, /About 10 minutes after Email 2/);
  assert.match(html, /Content-planning recap/);
  assert.match(html, /Confirmation email · Sent first/);
  assert.doesNotMatch(html, /Invitation|promotional|Plain-text version|transactional/i);
  assert.doesNotMatch(build, /site\/emails\/promotional|site\/emails\/plain-text/);
});

test("Demo 1 preserves the tested email-client foundation", async () => {
  const html = await readFile("site/emails/confirmation.html", "utf8");
  for (const marker of [
    "xmlns:v=\"urn:schemas-microsoft-com:vml\"",
    "<o:OfficeDocumentSettings>",
    "<!--[if mso]>",
    "mso-table-lspace: 0pt !important",
    "@media only screen and (min-device-width: 320px)",
    ".stack-column-center",
    "Preview Text Spacing Hack : BEGIN",
    "max-width: 680px"
  ]) assert.match(html, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), marker);

  assert.match(html, /conference-group-front-email\.jpg/);
  assert.match(html, /ortiz_profie_\.png/);
  assert.match(html, /workshop_ct\.png/);
  assert.match(html, /<td align="left" width="70%" style="width:70%;[^>]*>Commonlight Studio<\/td>\s*<td align="right" width="30%" style="width:30%;[^>]*>Demo 1 of 3<\/td>/);
  assert.match(html, /<a href="https:\/\/email-clarity-webinar-demo\.netlify\.app\/" style="color:#1f493b; font-weight:bold; text-decoration:underline;">How Small Nonprofit Teams Can Build a Better Content Workflow<\/a>/);
  assert.match(html, /We&rsquo;d love to see you there\. <a href="https:\/\/email-clarity-webinar-demo\.netlify\.app\/"[^>]*>View the workshop page\.<\/a>/);
  assert.match(html, /<td align="center"\s+style="padding: 0;">\s*<p[^>]+text-align: left;/);
  assert.doesNotMatch(html, /WNET|THIRTEEN|AMPscript|%%|image\.email/i);
});

test("double opt-in uses the tested foundation and production confirmation link", async () => {
  const html = await readFile("site/emails/double-opt-in.html", "utf8");
  assert.match(html, /<o:OfficeDocumentSettings>/);
  assert.match(html, /Preview Text Spacing Hack : BEGIN/);
  assert.doesNotMatch(html, /Confirmation required/);
  assert.match(html, />Email Clarity<\/td>\s*<\/tr>/);
  assert.match(html, /confirm-cta\.png/);
  assert.match(html, /https:\/\/email-clarity-webinar-demo\.netlify\.app\/sequence-confirmed\.html\?confirmation=brevo/);
  assert.equal(html.match(/href="https:\/\/email-clarity-webinar-demo\.netlify\.app\/sequence-confirmed\.html\?confirmation=brevo"/g)?.length, 3);
  assert.doesNotMatch(html, /conference-group/);
  assert.doesNotMatch(html, /localhost|double_opt_in_url/);
});

test("Commonlight emails define readable dark-mode surfaces", async () => {
  for (const page of ["double-opt-in.html", "confirmation.html", "reminder.html", "follow-up.html", "promotional.html"]) {
    const html = await readFile(`site/emails/${page}`, "utf8");
    assert.match(html, /@media \(prefers-color-scheme: dark\)/, page);
    assert.match(html, /class="callout"/, page);
    assert.match(html, /\.callout td \{[\s\S]*?background-color: #1f493b !important;[\s\S]*?color: #ffffff !important;/, page);
    assert.match(html, /class="dark-footer"/, page);
    assert.match(html, /\.dark-footer td \{[\s\S]*?background-color: #132d25 !important;[\s\S]*?color: #ffffff !important;/, page);
    assert.match(html, /\.button \{\s*filter: none !important;/, page);
    assert.match(html, /table\[width="600"\],[\s\S]*?table\[width="578"\][\s\S]*?width: 100% !important;/, page);
  }

  for (const page of ["confirmation.html", "reminder.html", "follow-up.html"]) {
    assert.match(await readFile(`site/emails/${page}`, "utf8"), /class="signer-block"/, page);
  }
});

test("email previews permit inline email CSS without relaxing the main site", async () => {
  const config = await readFile("netlify.toml", "utf8");
  assert.match(config, /for = "\/emails\/\*"[\s\S]*?style-src 'unsafe-inline'/);
  assert.match(config, /for = "\/\*"[\s\S]*?style-src 'self';/);
});

test("Demo 2 uses the approved tested email foundation", async () => {
  const html = await readFile("site/emails/reminder.html", "utf8");
  assert.match(html, /<o:OfficeDocumentSettings>/);
  assert.match(html, /Preview Text Spacing Hack : BEGIN/);
  assert.match(html, /Demo 2 of 3/);
  assert.match(html, /Your practical content workshop reminder/);
  assert.match(html, /conference-group-email\.jpg/);
  assert.match(html, /workshop_ct\.png/);
  assert.match(html, /ortiz_profie_\.png/);
});

test("Demo 3 uses the approved tested email foundation and inquiry CTA", async () => {
  const html = await readFile("site/emails/follow-up.html", "utf8");
  assert.match(html, /<o:OfficeDocumentSettings>/);
  assert.match(html, /Preview Text Spacing Hack : BEGIN/);
  assert.match(html, /Demo 3 of 3/);
  assert.match(html, /Keep the system practical/);
  assert.match(html, /email_clarity_cta\.png/);
  assert.match(html, /https:\/\/getemailclarity\.com\/#inquiry/);
  assert.match(html, /ortiz_profie_\.png/);
});
