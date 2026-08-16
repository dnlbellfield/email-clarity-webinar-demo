const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  },
  body: JSON.stringify(body)
});

function validEmail(value) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function cleanString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function handler(event) {
  if (event.httpMethod === "GET") {
    return json(200, { mode: "inactive" });
  }
  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed." });
  }

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { message: "The request was not valid JSON." });
  }

  const email = cleanString(input.email, 254).toLowerCase();
  const firstName = cleanString(input.firstName, 80);
  if (!validEmail(email)) {
    return json(400, { message: "Enter a valid email address." });
  }
  if (input.consent !== true) {
    return json(400, { message: "Explicit consent is required for the demo sequence." });
  }

  // Intentionally inactive. This validates the future request contract but does
  // not log, store, subscribe, or send the supplied contact data.
  void firstName;
  return json(200, {
    success: true,
    mode: "inactive",
    delivery: "inactive",
    message: "The local interface was validated. Public delivery is not active."
  });
}

