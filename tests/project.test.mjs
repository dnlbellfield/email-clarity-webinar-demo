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

test("case study and campaign experiences contain demo disclosure", async () => {
  for (const page of ["index.html", "register.html", "email-previews.html"]) {
    assert.match(await readFile(`site/${page}`, "utf8"), /Demo project:/, page);
  }
});
