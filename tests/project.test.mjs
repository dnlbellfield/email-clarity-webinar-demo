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

test("case study contains clear disclosure", async () => {
  const caseStudy = await readFile("site/index.html", "utf8");
  assert.match(caseStudy, /Case study note:/i);
  assert.match(caseStudy, /created to simulate a complete online-event campaign/i);
  assert.match(caseStudy, /not client work/i);
  assert.match(caseStudy, /does not report real-world results/i);
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

test("primary navigation connects the campaign, case study, and email previews", async () => {
  const caseStudy = await readFile("site/index.html", "utf8");
  const campaign = await readFile("site/register.html", "utf8");
  const emails = await readFile("site/email-previews.html", "utf8");

  for (const html of [campaign, caseStudy, emails]) {
    assert.match(html, /<nav class="site-nav" aria-label="Primary navigation">/);
    assert.match(html, /href="\/"[^>]*>Campaign Demo<\/a>/);
    assert.match(html, /href="\/case-study\.html"[^>]*>Case Study<\/a>/);
    assert.match(html, /href="\/email-previews\.html"[^>]*>Email Previews<\/a>/);
  }

  assert.match(campaign, /href="\/" aria-current="page">Campaign Demo<\/a>/);
  assert.match(caseStudy, /href="\/case-study\.html" aria-current="page">Case Study<\/a>/);
  assert.match(emails, /href="\/email-previews\.html" aria-current="page">Email Previews<\/a>/);
  assert.match(caseStudy, /href="\/"[^>]*>See the sign-up experience/);
  assert.match(caseStudy, /href="\/email-previews\.html">Preview the emails/);
  assert.match(caseStudy, />Commonlight Studio case study</);
  assert.doesNotMatch(caseStudy, /portfolio project|portfolio example/i);
  assert.doesNotMatch(caseStudy, /href="\/confirmation\.html"/);
  assert.match(campaign, /href="\/case-study\.html">View the Email Clarity project case study/);
});

test("inbox sequence is explicitly labeled and unsubscribable", async () => {
  const doubleOptIn = await readFile("site/emails/double-opt-in.html", "utf8");
  assert.match(doubleOptIn, /Confirm your Commonlight demo sequence/i);
  for (const [page, position] of [["confirmation.html", "1"], ["reminder.html", "2"], ["follow-up.html", "3"]]) {
    const html = await readFile(`site/emails/${page}`, "utf8");
    assert.match(html, new RegExp(`(?:Demo|Email) ${position} of 3`, "i"), page);
    assert.match(html, /\{\{ unsubscribe \}\}/, page);
  }
});

test("emails omit portfolio and fictional-project disclosure copy", async () => {
  const emailFiles = [
    "site/emails/double-opt-in.html",
    "site/emails/confirmation.html",
    "site/emails/reminder.html",
    "site/emails/follow-up.html",
    "site/emails/promotional.html",
    "site/emails/plain-text/confirmation.txt",
    "site/emails/plain-text/reminder.txt",
    "site/emails/plain-text/follow-up.txt",
    "site/emails/plain-text/promotional.txt"
  ];
  const combined = (await Promise.all(emailFiles.map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(combined, /Portfolio example|not real|\bfictional\b|show how a complete campaign can work/i);
});

test("sequence emails use their numbered production banner above the hero image", async () => {
  for (const [page, position] of [["confirmation.html", "01"], ["reminder.html", "02"], ["follow-up.html", "03"]]) {
    const html = await readFile(`site/emails/${page}`, "utf8");
    const banner = `https://email-clarity-webinar-demo.netlify.app/assets/images/email_banner_${position}.jpeg`;
    assert.match(html, new RegExp(banner.replaceAll(".", "\\.")), page);
    assert.ok(html.indexOf(banner) < html.indexOf("conference-group"), page);
    assert.match(html, new RegExp(`src="${banner.replaceAll(".", "\\.")}"[^>]+width="680"[^>]+width: 100%; max-width: 680px; height: auto; margin: 0 auto;`), page);
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

test("email preview cards expose subjects and an accessible reusable preview dialog", async () => {
  const html = await readFile("site/email-previews.html", "utf8");
  const js = await readFile("site/assets/app.js", "utf8");
  for (const subject of [
    "Your workshop details: A Practical Content System",
    "Workshop reminder: A Practical Content System",
    "Your Commonlight content-planning recap"
  ]) assert.match(html, new RegExp(subject));
  assert.equal(html.match(/data-email-dialog-open/g)?.length, 8);
  assert.equal(html.match(/<button class="email-preview-thumbnail"/g)?.length, 4);
  assert.equal(html.match(/class="email-preview-thumbnail"[^>]+aria-label="View full/g)?.length, 4);
  assert.equal(html.match(/data-email-image-src=/g)?.length, 4);
  assert.equal(html.match(/class="email-preview-full"/g)?.length, 1);
  assert.doesNotMatch(html, /<iframe|data-email-src=|\/emails\/.+\.html/);
  for (const image of ["double-opt-in.jpeg", "email-1.jpeg", "reminder-email-2.jpeg", "follow-up-email-3.jpeg"]) {
    assert.match(html, new RegExp(`/assets/images/${image}`));
  }
  assert.match(html, /<dialog[^>]+aria-labelledby="email-dialog-title"/);
  assert.match(js, /dialog\.showModal\(\)/);
  assert.match(js, /event\.key === "Escape"/);
  assert.match(js, /event\.key !== "Tab"/);
  assert.match(js, /event\.target === dialog/);
  assert.match(js, /trigger\?\.focus\(\)/);
  assert.match(js, /document\.body\.style\.overflow = "hidden"/);
  assert.match(js, /activeImage\.src = card\.dataset\.emailImageSrc/);
  assert.doesNotMatch(js, /contentDocument|activeFrame|emailFrameTitle/);
});

test("promotional email uses the production workshop preview image", async () => {
  const html = await readFile("site/emails/promotional.html", "utf8");
  assert.match(html, /<table[^>]+width="600"[^>]+bgcolor="#1f493b"[^>]+class="callout">/);
  assert.match(html, /<h2[^>]*>See a better content workflow in action<\/h2>/);
  assert.match(html, /src="https:\/\/email-clarity-webinar-demo\.netlify\.app\/assets\/images\/zoom\.jpeg"/);
  assert.match(html, /width="600"[^>]+max-width: 600px; height: auto; margin: 0 auto;/);
  assert.match(html, /alt="Lena Ortiz presenting the content workflow workshop to an online audience"/);
});

test("Email 1 preserves the tested email-client foundation", async () => {
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
  assert.match(html, /<td align="left" width="70%" style="width:70%;[^>]*>Commonlight Studio<\/td>\s*<td align="right" width="30%" style="width:30%;[^>]*>Email 1 of 3<\/td>/);
  assert.match(html, /<a href="https:\/\/email-clarity-webinar-demo\.netlify\.app\/[^"]*" style="color:#1f493b; font-weight:bold; text-decoration:underline;">How Small Nonprofit Teams Can Build a Better Content Workflow<\/a>/);
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

test("Email 2 uses the approved tested email foundation", async () => {
  const html = await readFile("site/emails/reminder.html", "utf8");
  assert.match(html, /<o:OfficeDocumentSettings>/);
  assert.match(html, /Preview Text Spacing Hack : BEGIN/);
  assert.match(html, /Email 2 of 3/);
  assert.match(html, /Your practical content workshop reminder/);
  assert.match(html, /conference-group-email\.jpg/);
  assert.match(html, /workshop_ct\.png/);
  assert.match(html, /ortiz_profie_\.png/);
});

test("Email 3 uses the approved tested email foundation and inquiry CTA", async () => {
  const html = await readFile("site/emails/follow-up.html", "utf8");
  assert.match(html, /<o:OfficeDocumentSettings>/);
  assert.match(html, /Preview Text Spacing Hack : BEGIN/);
  assert.match(html, /Email 3 of 3/);
  assert.match(html, /Put a Better Content Workflow Into Practice/);
  assert.equal(html.match(/https:\/\/email-clarity-webinar-demo\.netlify\.app\/assets\/images\/discuss-cta\.png/g)?.length, 1);
  assert.match(html, /href="https:\/\/email-clarity-webinar-demo\.netlify\.app\/case-study\.html"[^>]*>[\s\S]*?src="https:\/\/email-clarity-webinar-demo\.netlify\.app\/assets\/images\/case-study-cta\.jpeg"/);
  assert.ok(html.indexOf("case-study-cta.jpeg") < html.indexOf("Thanks for exploring"));
  assert.ok(html.indexOf("case-study-cta.jpeg") < html.indexOf("discuss-cta.png"));
  assert.match(html, /https:\/\/getemailclarity\.com\/#inquiry/);
  assert.match(html, /ortiz_profie_\.png/);
});
