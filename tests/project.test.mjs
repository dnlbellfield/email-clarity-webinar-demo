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

test("registration fields have explicit labels and no analytics PII interpolation", async () => {
  const html = await readFile("site/register.html", "utf8");
  for (const id of ["firstName", "email", "organization"]) assert.match(html, new RegExp(`for="${id}"`));
  const js = await readFile("site/assets/app.js", "utf8");
  const trackCalls = [...js.matchAll(/track\([^;]+/g)].map((match) => match[0]).join("\n");
  assert.doesNotMatch(trackCalls, /\.value|firstName|organization|email_address/);
  assert.doesNotMatch(js, /generate_lead|inquiry_success/);
});

test("portfolio layers contain clear disclosure", async () => {
  const caseStudy = await readFile("site/index.html", "utf8");
  assert.match(caseStudy, /self-initiated concept/i);
  assert.match(caseStudy, /fictional/i);
  assert.match(caseStudy, /not client work/i);
  assert.match(caseStudy, /no performance results/i);
  assert.match(await readFile("site/email-previews.html", "utf8"), /Portfolio project:/);
});

test("campaign landing stays free of portfolio implementation language", async () => {
  const html = await readFile("site/register.html", "utf8");
  assert.doesNotMatch(html, /fictional|simulat|\bdemo\b|Brevo|dataLayer|GTM|GA4|test mode/i);
  for (const image of ["conference-group-front.jpg", "conference_ortiz.jpg", "conference-group.jpg"]) {
    assert.match(html, new RegExp(image));
  }
});

test("navigation preserves the campaign and portfolio hierarchy", async () => {
  const caseStudy = await readFile("site/index.html", "utf8");
  const campaign = await readFile("site/register.html", "utf8");
  const emails = await readFile("site/email-previews.html", "utf8");
  assert.match(caseStudy, /href="\/">Experience the Commonlight campaign/);
  assert.match(caseStudy, /href="\/email-previews\.html">View campaign emails/);
  assert.doesNotMatch(caseStudy, /href="\/confirmation\.html"/);
  assert.doesNotMatch(campaign, /href="\/email-previews\.html"/);
  assert.match(campaign, /href="\/case-study\.html">View the Email Clarity project case study/);
  assert.match(emails, /href="\/case-study\.html">Back to project case study/);
});

test("email artifacts contain natural campaign copy without wrapper disclosures", async () => {
  for (const page of ["promotional.html", "confirmation.html", "reminder.html", "follow-up.html"]) {
    const html = await readFile(`site/emails/${page}`, "utf8");
    assert.doesNotMatch(html, /fictional|demo project|demonstration/i, page);
  }
});
