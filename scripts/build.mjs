import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

const dist = new URL("../dist/", import.meta.url);
const root = new URL("../", import.meta.url);

const files = [
  "site/index.html",
  "site/register.html",
  "site/confirmation.html",
  "site/email-previews.html",
  "site/automation.html",
  "site/tracking.html",
  "site/privacy.html",
  "site/404.html",
  "site/assets/app.js",
  "site/emails/promotional.html",
  "site/emails/confirmation.html",
  "site/emails/reminder.html",
  "site/emails/follow-up.html",
  "site/emails/plain-text/promotional.txt",
  "site/emails/plain-text/confirmation.txt",
  "site/emails/plain-text/reminder.txt",
  "site/emails/plain-text/follow-up.txt"
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of files) {
  const output = new URL(file.replace(/^site\//, ""), dist);
  await mkdir(dirname(output.pathname), { recursive: true });
  await cp(new URL(file, root), output);
}

await mkdir(new URL("assets/", dist), { recursive: true });
await cp(new URL(".build/site.css", root), new URL("assets/site.css", dist));

const topLevel = await readdir(dist);
console.log(`Built ${files.length + 1} allowlisted files into dist/: ${topLevel.join(", ")}`);
