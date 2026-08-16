import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname } from "node:path";

const dist = new URL("../dist/", import.meta.url);
const root = new URL("../", import.meta.url);

const entries = [
  { source: "site/register.html", output: "index.html" },
  { source: "site/index.html", output: "case-study.html" },
  "site/confirmation.html",
  "site/sequence-confirmed.html",
  "site/email-previews.html",
  "site/assets/app.js",
  "site/assets/images/conference-group-front.jpg",
  "site/assets/images/conference-group-front-email.jpg",
  "site/assets/images/conference-group.jpg",
  "site/assets/images/conference-group-email.jpg",
  "site/assets/images/conference_ortiz.jpg",
  "site/assets/images/confirm-cta.png",
  "site/assets/images/confirm-demo-sequence.png",
  "site/assets/images/email_clarity_cta.png",
  "site/assets/images/ortiz_conf.jpeg",
  "site/assets/images/ortiz_profie_.png",
  "site/assets/images/workshop_ct.png",
  "site/emails/promotional.html",
  "site/emails/double-opt-in.html",
  "site/emails/confirmation.html",
  "site/emails/reminder.html",
  "site/emails/follow-up.html",
  "site/emails/plain-text/promotional.txt",
  "site/emails/plain-text/double-opt-in.txt",
  "site/emails/plain-text/confirmation.txt",
  "site/emails/plain-text/reminder.txt",
  "site/emails/plain-text/follow-up.txt"
].map((entry) => typeof entry === "string" ? { source: entry, output: entry.replace(/^site\//, "") } : entry);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of entries) {
  const output = new URL(entry.output, dist);
  await mkdir(dirname(output.pathname), { recursive: true });
  await cp(new URL(entry.source, root), output);
}

await mkdir(new URL("assets/", dist), { recursive: true });
await cp(new URL(".build/site.css", root), new URL("assets/site.css", dist));

const topLevel = await readdir(dist);
console.log(`Built ${entries.length + 1} allowlisted files into dist/: ${topLevel.join(", ")}`);
