const page = document.body.dataset.page || "unknown";
const allowedEvents = new Set([
  "demo_sequence_cta_click",
  "demo_sequence_request",
  "demo_sequence_confirmation_view",
  "demo_sequence_confirmed",
  "demo_email_preview",
  "demo_project_cta_click"
]);

let sequenceMode = "inactive";

function fixedValue(value) {
  return typeof value === "string" && /^[a-z0-9_-]{1,40}$/.test(value);
}

function track(event, parameters = {}) {
  if (!allowedEvents.has(event)) return;
  const safeParameters = Object.fromEntries(
    Object.entries(parameters).filter(([, value]) => fixedValue(value))
  );
  const detail = { event, ...safeParameters };
  document.dispatchEvent(new CustomEvent("demo:track", { detail }));
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(detail);
}

async function getSequenceMode() {
  try {
    const response = await fetch("/.netlify/functions/demo-sequence", { headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const data = await response.json();
    sequenceMode = data.mode === "active" ? "active" : "inactive";
  } catch {
    sequenceMode = "inactive";
  }
}

function setError(input, message) {
  const error = document.querySelector(`#${input.id}-error`);
  input.setAttribute("aria-invalid", message ? "true" : "false");
  if (error) error.textContent = message;
}

function validate(form) {
  let valid = true;
  const email = form.elements.email;
  const consent = form.elements.sequenceConsent;
  setError(email, "");
  setError(consent, "");
  if (!email.value.trim() || !email.validity.valid) {
    setError(email, "Enter a valid email address.");
    valid = false;
  }
  if (!consent.checked) {
    setError(consent, "Select the checkbox to consent to the three-email sequence.");
    valid = false;
  }
  return valid;
}

function initSequenceForm() {
  const form = document.querySelector("[data-sequence-form]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validate(form)) {
      document.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    const status = document.querySelector("[data-form-status]");
    button.disabled = true;
    button.textContent = "Preparing the sequence…";
    status.textContent = "Validating your request.";

    let result = { success: true, delivery: "inactive" };
    try {
      const response = await fetch("/.netlify/functions/demo-sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email: form.elements.email.value.trim(),
          firstName: form.elements.firstName.value.trim(),
          consent: form.elements.sequenceConsent.checked
        })
      });
      const responseBody = await response.json();
      if (!response.ok) throw new Error(responseBody.message || "The request could not be validated.");
      result = responseBody;
    } catch (error) {
      if (sequenceMode === "active") {
        status.textContent = error.message || "The request could not be completed. Please try again.";
        button.disabled = false;
        button.textContent = "Send the demo sequence";
        status.focus();
        return;
      }
    }

    sessionStorage.setItem("commonlight_sequence_delivery", result.delivery === "active" ? "active" : "inactive");
    track("demo_sequence_request", { delivery_mode: result.delivery === "active" ? "active" : "inactive" });
    window.location.assign("/confirmation.html");
  });
}

function initInteractiveTracking() {
  document.querySelectorAll("[data-track-sequence-cta]").forEach((link) => link.addEventListener("click", () => {
    track("demo_sequence_cta_click", { placement: page });
  }));
  document.querySelectorAll("[data-email-preview]").forEach((element) => {
    track("demo_email_preview", { email_type: element.dataset.emailPreview });
  });
  document.querySelectorAll("[data-track-project-cta]").forEach((link) => link.addEventListener("click", () => {
    track("demo_project_cta_click", { placement: page });
  }));
}

function initConfirmation() {
  const element = document.querySelector("[data-confirmation-mode]");
  if (!element) return;
  const delivery = sessionStorage.getItem("commonlight_sequence_delivery") === "active" ? "active" : "inactive";
  element.textContent = delivery === "active"
    ? "Check your inbox for the Email Clarity confirmation message. The sequence will begin only after you confirm your address."
    : "This local request was validated only. No details were stored and no email was sent.";
  track("demo_sequence_confirmation_view", { delivery_mode: delivery });
}

window.dataLayer = window.dataLayer || [];
getSequenceMode();
initSequenceForm();
initInteractiveTracking();
initConfirmation();
if (new URLSearchParams(window.location.search).get("campaign_source") === "promotional_email") {
  track("demo_sequence_cta_click", { placement: "promotional_email" });
}
