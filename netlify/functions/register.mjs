const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  },
  body: JSON.stringify(body)
});

function operatingMode(env) {
  return env.DEMO_MODE === "test" ? "test" : "preview";
}

function allowedAddresses(env) {
  return new Set((env.DEMO_ALLOWED_EMAILS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function validEmail(value) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function cleanString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function handler(event, context = {}, dependencies = {}) {
  const env = dependencies.env || process.env;
  const requestFetch = dependencies.fetch || fetch;
  const mode = operatingMode(env);

  if (event.httpMethod === "GET") return json(200, { mode });
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed." });

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { message: "The request was not valid JSON." });
  }

  const firstName = cleanString(input.firstName, 80);
  const email = cleanString(input.email, 254).toLowerCase();
  const organization = cleanString(input.organization, 120);
  if (!firstName || !validEmail(email)) return json(400, { message: "Enter a first name and valid email address." });

  if (mode === "preview") {
    return json(200, { success: true, mode: "preview", message: "Preview registration simulated." });
  }

  if (!allowedAddresses(env).has(email)) {
    return json(403, { success: false, mode: "test", message: "This address is not approved for controlled testing." });
  }

  const listId = Number.parseInt(env.BREVO_LIST_ID, 10);
  if (!env.BREVO_API_KEY || !Number.isSafeInteger(listId)) {
    return json(503, { success: false, mode: "test", message: "The test integration is not configured." });
  }

  const attributes = { FIRSTNAME: firstName };
  if (organization) attributes.ORGANIZATION = organization;
  const response = await requestFetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": env.BREVO_API_KEY
    },
    body: JSON.stringify({ email, attributes, listIds: [listId], updateEnabled: true })
  });

  if (!response.ok) {
    return json(502, { success: false, mode: "test", message: "Brevo did not accept the controlled test registration." });
  }
  return json(200, { success: true, mode: "test", message: "Controlled test registration accepted." });
}

