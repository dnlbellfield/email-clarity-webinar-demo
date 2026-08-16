import assert from "node:assert/strict";
import test from "node:test";
import { handleRequest } from "../netlify/functions/demo-sequence.mjs";

const inactiveEnv = { DEMO_SEQUENCE_MODE: "inactive" };
const testEnv = {
  DEMO_SEQUENCE_MODE: "test",
  DEMO_SEQUENCE_ALLOWED_ORIGINS: "http://localhost:8888",
  DEMO_SEQUENCE_CONSENT_VERSION: "commonlight-demo-v1",
  DEMO_SEQUENCE_REENTRY_HOURS: "0",
  DEMO_SEQUENCE_TEST_EMAILS: "owner@example.com",
  BREVO_API_KEY: "test-api-key",
  BREVO_TEMP_LIST_ID: "101",
  BREVO_CONFIRMED_LIST_ID: "102",
  TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  TURNSTILE_ALLOWED_HOSTNAMES: "localhost"
};

const body = { email: "owner@example.com", firstName: "Avery", consent: true, turnstileToken: "XXXX.DUMMY.TOKEN.XXXX" };
const request = (method = "POST", value = body, origin = "http://localhost:8888") => new Request("http://localhost:8888/api/demo-sequence", {
  method,
  headers: method === "POST" ? { "Content-Type": "application/json", Origin: origin } : undefined,
  body: method === "POST" ? JSON.stringify(value) : undefined
});
const data = async (response) => response.json();

test("inactive mode reports consistently and does not expose a Turnstile key", async () => {
  const result = await handleRequest(request("GET"), {}, { env: inactiveEnv });
  assert.equal(result.status, 200);
  assert.deepEqual(await data(result), {
    mode: "inactive",
    configuredMode: "inactive",
    configurationReady: true,
    turnstileRequired: false,
    turnstileSiteKey: ""
  });
});

test("an incomplete test configuration fails closed", async () => {
  const env = { ...testEnv, BREVO_API_KEY: "" };
  const status = await handleRequest(request("GET"), {}, { env });
  assert.equal((await data(status)).mode, "inactive");
  const submission = await handleRequest(request(), {}, { env });
  assert.equal(submission.status, 503);
});

test("inactive submission validates without calling an external service", async () => {
  let calls = 0;
  const result = await handleRequest(request(), {}, { env: inactiveEnv, fetchImpl: async () => { calls += 1; } });
  const response = await data(result);
  assert.equal(result.status, 200);
  assert.equal(response.delivery, "inactive");
  assert.equal(response.email, undefined);
  assert.equal(calls, 0);
});

test("test mode rejects an unapproved origin and non-allowlisted address", async () => {
  const wrongOrigin = await handleRequest(request("POST", body, "https://attacker.example"), {}, { env: testEnv });
  assert.equal(wrongOrigin.status, 403);
  const wrongEmail = await handleRequest(request("POST", { ...body, email: "other@example.com" }), {}, { env: testEnv });
  assert.equal(wrongEmail.status, 403);
});

test("test mode requires a successful Turnstile result", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ success: false, action: "test", hostname: "localhost" }), { status: 200 });
  const result = await handleRequest(request(), { ip: "127.0.0.1" }, { env: testEnv, fetchImpl });
  assert.equal(result.status, 400);
  assert.match((await data(result)).message, /security check/i);
});

test("test mode sends an allowlisted, consented contact to only the pending Brevo list", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("siteverify")) {
      return new Response(JSON.stringify({ success: true, action: "test", hostname: "localhost" }), { status: 200 });
    }
    if (init.method === "POST") return new Response(JSON.stringify({ id: 42 }), { status: 201 });
    return new Response(JSON.stringify({ code: "not_found" }), { status: 404 });
  };
  const now = new Date("2026-08-15T20:00:00.000Z");
  const result = await handleRequest(request(), { ip: "127.0.0.1" }, { env: testEnv, fetchImpl, now });
  const response = await data(result);
  assert.equal(result.status, 200);
  assert.equal(response.delivery, "test");
  assert.equal(response.state, "confirmation_pending");
  assert.equal(response.email, undefined);

  const brevoPost = calls.find((call) => call.url.endsWith("/v3/contacts") && call.init.method === "POST");
  const payload = JSON.parse(brevoPost.init.body);
  assert.deepEqual(payload.listIds, [101]);
  assert.equal(payload.updateEnabled, true);
  assert.equal(payload.emailBlacklisted, undefined);
  assert.equal(payload.attributes.FIRSTNAME, "Avery");
  assert.equal(payload.attributes.DEMO_SEQ_CONSENT_AT, now.toISOString());
  assert.equal(payload.attributes.DEMO_SEQ_SOURCE, "commonlight-test");
  assert.equal(brevoPost.init.headers["api-key"], "test-api-key");
});

test("an existing pending contact is not re-added or retriggered", async () => {
  let brevoPosts = 0;
  const fetchImpl = async (url, init = {}) => {
    if (String(url).includes("siteverify")) {
      return new Response(JSON.stringify({ success: true, action: "test", hostname: "localhost" }), { status: 200 });
    }
    if (init.method === "POST") brevoPosts += 1;
    return new Response(JSON.stringify({ emailBlacklisted: false, listIds: [101], attributes: { DEMO_SEQ_STATUS: "pending" } }), { status: 200 });
  };
  const result = await handleRequest(request(), {}, { env: testEnv, fetchImpl });
  assert.equal(result.status, 200);
  assert.equal(brevoPosts, 0);
});

test("an unsubscribed contact is never unblocked or re-added", async () => {
  let brevoPosts = 0;
  const fetchImpl = async (url, init = {}) => {
    if (String(url).includes("siteverify")) {
      return new Response(JSON.stringify({ success: true, action: "test", hostname: "localhost" }), { status: 200 });
    }
    if (init.method === "POST") brevoPosts += 1;
    return new Response(JSON.stringify({ emailBlacklisted: true, listIds: [] }), { status: 200 });
  };
  const result = await handleRequest(request(), {}, { env: testEnv, fetchImpl });
  assert.equal(result.status, 200);
  assert.equal(brevoPosts, 0);
});

test("public mode rejects Cloudflare test credentials", async () => {
  const env = {
    ...testEnv,
    DEMO_SEQUENCE_MODE: "public",
    DEMO_SEQUENCE_REENTRY_HOURS: "24",
    PUBLIC_SITE_URL: "https://demo.example.com",
    DEMO_SEQUENCE_CONFIRM_URL: "https://demo.example.com/sequence-confirmed.html?confirmation=brevo"
  };
  const result = await handleRequest(request("GET"), {}, { env });
  const response = await data(result);
  assert.equal(response.configuredMode, "public");
  assert.equal(response.mode, "inactive");
  assert.equal(response.configurationReady, false);
});
