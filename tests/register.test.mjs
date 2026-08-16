import assert from "node:assert/strict";
import test from "node:test";
import { handler } from "../netlify/functions/register.mjs";

const post = (body) => ({ httpMethod: "POST", body: JSON.stringify(body) });
const person = { firstName: "Avery", email: "owner@example.com", organization: "Community Arts" };

test("preview mode simulates and never calls Brevo", async () => {
  let called = false;
  const result = await handler(post(person), {}, { env: { DEMO_MODE: "preview" }, fetch: async () => { called = true; } });
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).mode, "preview");
  assert.equal(called, false);
});

test("test mode blocks an address not in the server allowlist", async () => {
  const result = await handler(post({ ...person, email: "visitor@example.com" }), {}, {
    env: { DEMO_MODE: "test", DEMO_ALLOWED_EMAILS: "owner@example.com" }
  });
  assert.equal(result.statusCode, 403);
});

test("test mode maps an allowlisted contact to Brevo", async () => {
  let request;
  const result = await handler(post(person), {}, {
    env: { DEMO_MODE: "test", DEMO_ALLOWED_EMAILS: "OWNER@example.com", BREVO_API_KEY: "test-key", BREVO_LIST_ID: "42" },
    fetch: async (url, options) => { request = { url, options }; return { ok: true }; }
  });
  assert.equal(result.statusCode, 200);
  assert.equal(request.url, "https://api.brevo.com/v3/contacts");
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body, { email: "owner@example.com", attributes: { FIRSTNAME: "Avery", ORGANIZATION: "Community Arts" }, listIds: [42], updateEnabled: true });
});

test("invalid submissions are rejected before integration work", async () => {
  const result = await handler(post({ firstName: "", email: "not-an-email" }), {}, { env: { DEMO_MODE: "preview" } });
  assert.equal(result.statusCode, 400);
});

