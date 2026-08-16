const BREVO_API_URL = "https://api.brevo.com/v3";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ACTION = "demo_sequence";
const MAX_BODY_BYTES = 8_192;
const TEST_TURNSTILE_SECRETS = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA"
]);

export const config = {
  path: "/api/demo-sequence",
  rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ["ip"] }
};

function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function list(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function validEmail(value) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function cleanName(value) {
  if (value == null || value === "") return "";
  if (typeof value !== "string") return null;
  const name = value.trim().normalize("NFC");
  if (name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

function urlOrigin(value) {
  try {
    const url = new URL(value);
    return url.pathname === "/" && !url.search && !url.hash ? url.origin : null;
  } catch {
    return null;
  }
}

function buildRuntime(env) {
  const requestedMode = ["inactive", "test", "public"].includes(env.DEMO_SEQUENCE_MODE)
    ? env.DEMO_SEQUENCE_MODE
    : "inactive";
  const allowedOrigins = new Set(list(env.DEMO_SEQUENCE_ALLOWED_ORIGINS).map(urlOrigin).filter(Boolean));
  const allowedHostnames = new Set(list(env.TURNSTILE_ALLOWED_HOSTNAMES).map((item) => item.toLowerCase()));
  const testEmails = new Set(list(env.DEMO_SEQUENCE_TEST_EMAILS).map((item) => item.toLowerCase()));
  const tempListId = positiveInteger(env.BREVO_TEMP_LIST_ID);
  const confirmedListId = positiveInteger(env.BREVO_CONFIRMED_LIST_ID);
  const reentryHours = Number(env.DEMO_SEQUENCE_REENTRY_HOURS || 24);
  const missing = [];

  if (requestedMode !== "inactive") {
    if (!env.BREVO_API_KEY) missing.push("BREVO_API_KEY");
    if (!tempListId) missing.push("BREVO_TEMP_LIST_ID");
    if (!confirmedListId) missing.push("BREVO_CONFIRMED_LIST_ID");
    if (!env.DEMO_SEQUENCE_CONSENT_VERSION) missing.push("DEMO_SEQUENCE_CONSENT_VERSION");
    if (!env.TURNSTILE_SITE_KEY) missing.push("TURNSTILE_SITE_KEY");
    if (!env.TURNSTILE_SECRET_KEY) missing.push("TURNSTILE_SECRET_KEY");
    if (!allowedOrigins.size) missing.push("DEMO_SEQUENCE_ALLOWED_ORIGINS");
    if (!allowedHostnames.size) missing.push("TURNSTILE_ALLOWED_HOSTNAMES");
    if (!Number.isFinite(reentryHours) || reentryHours < 0) missing.push("DEMO_SEQUENCE_REENTRY_HOURS");
  }
  if (requestedMode === "test" && !testEmails.size) missing.push("DEMO_SEQUENCE_TEST_EMAILS");
  if (requestedMode === "public") {
    if (reentryHours < 24) missing.push("DEMO_SEQUENCE_REENTRY_HOURS_PUBLIC_MINIMUM_24");
    if (TEST_TURNSTILE_SECRETS.has(env.TURNSTILE_SECRET_KEY)) missing.push("PRODUCTION_TURNSTILE_SECRET_KEY");
    try {
      if (new URL(env.PUBLIC_SITE_URL).protocol !== "https:") missing.push("PUBLIC_SITE_URL_HTTPS");
      const confirmation = new URL(env.DEMO_SEQUENCE_CONFIRM_URL);
      if (confirmation.protocol !== "https:" || confirmation.searchParams.get("confirmation") !== "brevo") {
        missing.push("DEMO_SEQUENCE_CONFIRM_URL_HTTPS_MARKER");
      }
    } catch {
      missing.push("PUBLIC_URLS");
    }
  }

  return {
    requestedMode,
    mode: missing.length ? "inactive" : requestedMode,
    ready: missing.length === 0,
    allowedOrigins,
    allowedHostnames,
    testEmails,
    tempListId,
    confirmedListId,
    reentryHours,
    apiKey: env.BREVO_API_KEY || "",
    consentVersion: env.DEMO_SEQUENCE_CONSENT_VERSION || "",
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || "",
    turnstileSecretKey: env.TURNSTILE_SECRET_KEY || ""
  };
}

async function verifyTurnstile(token, runtime, remoteIp, fetchImpl) {
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  const payload = new URLSearchParams({
    secret: runtime.turnstileSecretKey,
    response: token,
    idempotency_key: crypto.randomUUID()
  });
  if (remoteIp) payload.set("remoteip", remoteIp);
  const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload,
    signal: AbortSignal.timeout(5_000)
  });
  if (!response.ok) throw new Error("turnstile_unavailable");
  const result = await response.json();
  const allowedAction = result.action === TURNSTILE_ACTION
    || (TEST_TURNSTILE_SECRETS.has(runtime.turnstileSecretKey) && result.action === "test");
  return result.success === true
    && allowedAction
    && runtime.allowedHostnames.has(String(result.hostname || "").toLowerCase());
}

async function brevoRequest(path, runtime, fetchImpl, init = {}) {
  return fetchImpl(`${BREVO_API_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": runtime.apiKey,
      ...init.headers
    },
    signal: AbortSignal.timeout(8_000)
  });
}

async function getExistingContact(email, runtime, fetchImpl) {
  const response = await brevoRequest(`/contacts/${encodeURIComponent(email)}?identifierType=email_id`, runtime, fetchImpl);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("brevo_lookup_failed");
  return response.json();
}

function canReenter(contact, runtime, now) {
  if (!contact) return false;
  const status = String(contact.attributes?.DEMO_SEQ_STATUS || "").toLowerCase();
  if (!["complete", "expired"].includes(status)) return false;
  const consentAt = Date.parse(contact.attributes?.DEMO_SEQ_CONSENT_AT || "");
  if (!Number.isFinite(consentAt)) return false;
  return now.getTime() - consentAt >= runtime.reentryHours * 60 * 60 * 1_000;
}

async function handoffToBrevo({ email, firstName }, runtime, fetchImpl, now) {
  const existing = await getExistingContact(email, runtime, fetchImpl);
  if (existing?.emailBlacklisted === true) return;
  const listIds = new Set((existing?.listIds || []).map(Number));
  const inDemoList = listIds.has(runtime.tempListId) || listIds.has(runtime.confirmedListId);
  const reentry = canReenter(existing, runtime, now);
  if (inDemoList && !reentry) return;

  const attributes = {
    DEMO_SEQ_CONSENT_AT: now.toISOString(),
    DEMO_SEQ_CONSENT_VERSION: runtime.consentVersion,
    DEMO_SEQ_SOURCE: runtime.mode === "test" ? "commonlight-test" : "commonlight-public",
    DEMO_SEQ_STATUS: "pending"
  };
  if (firstName) attributes.FIRSTNAME = firstName;
  const payload = { email, attributes, listIds: [runtime.tempListId], updateEnabled: true };
  if (reentry && listIds.has(runtime.confirmedListId)) payload.unlinkListIds = [runtime.confirmedListId];
  const response = await brevoRequest("/contacts", runtime, fetchImpl, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("brevo_handoff_failed");
}

export async function handleRequest(request, context = {}, dependencies = {}) {
  const env = dependencies.env || process.env;
  const fetchImpl = dependencies.fetchImpl || fetch;
  const now = dependencies.now || new Date();
  const runtime = buildRuntime(env);

  if (request.method === "GET") {
    return json({
      mode: runtime.mode,
      configuredMode: runtime.requestedMode,
      configurationReady: runtime.ready,
      turnstileRequired: runtime.mode !== "inactive",
      turnstileSiteKey: runtime.mode !== "inactive" ? runtime.turnstileSiteKey : ""
    });
  }
  if (request.method !== "POST") return json({ message: "Method not allowed." }, { status: 405 });
  if (runtime.requestedMode !== "inactive" && !runtime.ready) {
    return json({ message: "The controlled email test is not fully configured." }, { status: 503 });
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return json({ message: "Content-Type must be application/json." }, { status: 415 });
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json({ message: "The request was too large." }, { status: 413 });
  }
  let input;
  try {
    input = JSON.parse(rawBody || "{}");
  } catch {
    return json({ message: "The request was not valid JSON." }, { status: 400 });
  }

  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const firstName = cleanName(input.firstName);
  if (!validEmail(email)) return json({ message: "Enter a valid email address." }, { status: 400 });
  if (firstName === null) return json({ message: "First name must be 80 characters or fewer." }, { status: 400 });
  if (input.consent !== true) {
    return json({ message: "Explicit consent is required for the demo sequence." }, { status: 400 });
  }
  if (runtime.mode === "inactive") {
    return json({ success: true, mode: "inactive", delivery: "inactive", message: "The local interface was validated. Public delivery is not active." });
  }

  const origin = urlOrigin(request.headers.get("origin"));
  if (!origin || !runtime.allowedOrigins.has(origin)) {
    return json({ message: "This request origin is not allowed." }, { status: 403 });
  }
  if (runtime.mode === "test" && !runtime.testEmails.has(email)) {
    return json({ message: "This email address is not enabled for the controlled test." }, { status: 403 });
  }

  let turnstileValid = false;
  try {
    turnstileValid = await verifyTurnstile(input.turnstileToken, runtime, context.ip, fetchImpl);
  } catch {
    return json({ message: "The security check is temporarily unavailable. Please try again." }, { status: 503 });
  }
  if (!turnstileValid) {
    return json({ message: "Complete the security check again and resubmit the form." }, { status: 400 });
  }
  try {
    await handoffToBrevo({ email, firstName }, runtime, fetchImpl, now);
  } catch {
    return json({ message: "The email request could not be completed. Please try again later." }, { status: 502 });
  }
  return json({ success: true, mode: runtime.mode, delivery: runtime.mode, state: "confirmation_pending", message: "Check your inbox to confirm your address." });
}

export default function demoSequence(request, context) {
  return handleRequest(request, context);
}
