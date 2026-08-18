import { readFile, readdir } from "node:fs/promises";

const expected = new Set([
  "assets/app.js", "assets/images/case-study-cta.png", "assets/images/conference-group-front-email.jpg", "assets/images/conference-group-front.jpg", "assets/images/conference-group-email.jpg", "assets/images/conference-group.jpg", "assets/images/conference_ortiz.jpg", "assets/images/confirm-cta.png", "assets/images/confirm-demo-sequence.png", "assets/images/discuss-cta.png", "assets/images/email_banner_01.jpeg", "assets/images/email_banner_02.jpeg", "assets/images/email_banner_03.jpeg", "assets/images/email_clarity_cta.png", "assets/images/ortiz_conf.jpeg", "assets/images/ortiz_profie_.png", "assets/images/workshop_ct.png", "assets/images/zoom.jpeg", "assets/site.css", "case-study.html", "confirmation.html",
  "email-previews.html", "emails/confirmation.html", "emails/double-opt-in.html", "emails/follow-up.html",
  "emails/reminder.html", "index.html", "sequence-confirmed.html"
]);

async function walk(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) paths.push(...await walk(`${directory}/${entry.name}`, `${relative}/`));
    else paths.push(relative);
  }
  return paths;
}

const actual = new Set(await walk("dist"));
const missing = [...expected].filter((file) => !actual.has(file));
const unexpected = [...actual].filter((file) => !expected.has(file));
if (missing.length || unexpected.length) {
  throw new Error(`dist allowlist mismatch. Missing: ${missing.join(", ") || "none"}. Unexpected: ${unexpected.join(", ") || "none"}.`);
}

for (const file of actual) {
  const contents = await readFile(`dist/${file}`, "utf8");
  if (/BREVO_API_KEY\s*=|xkeysib-[a-z0-9]/i.test(contents)) throw new Error(`Possible secret in dist/${file}`);
}
console.log(`Verified ${actual.size} production files and found no obvious secrets.`);
