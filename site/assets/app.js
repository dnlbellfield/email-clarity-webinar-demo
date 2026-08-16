const page = document.body.dataset.page || "unknown";
const consentKey = "commonlight_demo_analytics_consent";
const allowedEvents = new Set([
  "demo_email_cta_click",
  "demo_landing_view",
  "demo_registration_form_start",
  "demo_registration_attempt",
  "demo_registration_success",
  "demo_email_preview",
  "demo_automation_step_view"
]);

let analyticsConsent = localStorage.getItem(consentKey) === "granted";
let mode = "preview";

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
  if (analyticsConsent) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(detail);
  }
}

function loadGtm() {
  const id = document.querySelector('meta[name="demo-gtm-id"]')?.content;
  if (!analyticsConsent || !/^GTM-[A-Z0-9]+$/.test(id || "") || document.querySelector("script[data-demo-gtm]")) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: "demo_consent_update", analytics_storage: "granted" });
  const script = document.createElement("script");
  script.async = true;
  script.dataset.demoGtm = "true";
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
  document.head.append(script);
}

function initConsent() {
  const banner = document.querySelector("[data-consent-banner]");
  const stored = localStorage.getItem(consentKey);
  if (banner && !stored) banner.hidden = false;
  document.querySelectorAll("[data-consent-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      analyticsConsent = button.dataset.consentChoice === "accept";
      localStorage.setItem(consentKey, analyticsConsent ? "granted" : "denied");
      if (banner) banner.hidden = true;
      if (analyticsConsent) {
        loadGtm();
        track("demo_landing_view", { page_name: page });
      }
      updateConsentStatus();
    });
  });
  document.querySelector("[data-reset-consent]")?.addEventListener("click", () => {
    localStorage.removeItem(consentKey);
    window.location.reload();
  });
  updateConsentStatus();
  loadGtm();
}

function updateConsentStatus() {
  document.querySelectorAll("[data-consent-status]").forEach((element) => {
    const value = localStorage.getItem(consentKey);
    element.textContent = value === "granted" ? "Accepted" : value === "denied" ? "Declined" : "Not chosen";
  });
}

async function getMode() {
  try {
    const response = await fetch("/.netlify/functions/register", { headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const data = await response.json();
    mode = data.mode === "test" ? "test" : "preview";
  } catch {
    mode = "preview";
  }
  document.querySelectorAll("[data-mode-label]").forEach((element) => {
    element.textContent = mode === "test" ? "Controlled test mode" : "Public preview mode";
  });
  document.querySelectorAll("[data-mode-copy]").forEach((element) => {
    element.textContent = mode === "test"
      ? "Only explicitly allowlisted test addresses can enter the Brevo automation."
      : "This submission is simulated. No contact is created and no email is sent.";
  });
}

function setError(input, message) {
  const error = document.querySelector(`#${input.id}-error`);
  input.setAttribute("aria-invalid", message ? "true" : "false");
  if (error) error.textContent = message;
}

function validate(form) {
  let valid = true;
  const firstName = form.elements.firstName;
  const email = form.elements.email;
  setError(firstName, "");
  setError(email, "");
  if (!firstName.value.trim()) {
    setError(firstName, "Enter your first name.");
    valid = false;
  }
  if (!email.value.trim() || !email.validity.valid) {
    setError(email, "Enter a valid email address.");
    valid = false;
  }
  return valid;
}

function initForm() {
  const form = document.querySelector("[data-registration-form]");
  if (!form) return;
  let started = false;
  form.addEventListener("input", () => {
    if (!started) {
      started = true;
      track("demo_registration_form_start", { demo_mode: mode });
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validate(form)) {
      document.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    track("demo_registration_attempt", { demo_mode: mode, validation_result: "valid" });
    const button = form.querySelector('button[type="submit"]');
    const status = document.querySelector("[data-form-status]");
    button.disabled = true;
    button.textContent = "Registering…";
    status.textContent = "Submitting your registration.";
    try {
      let result = { mode: "preview", success: true };
      try {
        const response = await fetch("/.netlify/functions/register", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            firstName: form.elements.firstName.value.trim(),
            email: form.elements.email.value.trim(),
            organization: form.elements.organization.value.trim()
          })
        });
        result = await response.json();
        if (!response.ok) throw new Error(result.message || "Registration could not be completed.");
      } catch (error) {
        if (mode === "test") throw error;
      }
      sessionStorage.setItem("commonlight_demo_registration", result.mode === "test" ? "test" : "preview");
      track("demo_registration_success", { demo_mode: result.mode === "test" ? "test" : "preview" });
      window.location.assign("/confirmation.html");
    } catch (error) {
      status.textContent = error.message || "Registration could not be completed. Please try again.";
      button.disabled = false;
      button.textContent = "Register for the webinar";
      status.focus();
    }
  });
}

function initInteractiveTracking() {
  document.querySelectorAll("[data-track-email-cta]").forEach((link) => link.addEventListener("click", () => {
    track("demo_email_cta_click", { email_type: link.dataset.trackEmailCta });
  }));
  document.querySelectorAll("[data-email-preview]").forEach((element) => {
    track("demo_email_preview", { email_type: element.dataset.emailPreview });
  });
  document.querySelectorAll("details[data-automation-step]").forEach((details) => details.addEventListener("toggle", () => {
    if (details.open) track("demo_automation_step_view", { automation_step: details.dataset.automationStep });
  }));
}

function initConfirmation() {
  const element = document.querySelector("[data-confirmation-mode]");
  if (!element) return;
  const result = sessionStorage.getItem("commonlight_demo_registration");
  element.textContent = result === "test"
    ? "This approved test registration was sent securely to Brevo."
    : "This preview registration was simulated. No contact was created and no email was sent.";
}

window.dataLayer = window.dataLayer || [];
window.dataLayer.push({ event: "demo_consent_default", analytics_storage: "denied" });
initConsent();
getMode();
initForm();
initInteractiveTracking();
initConfirmation();
if (analyticsConsent) track("demo_landing_view", { page_name: page });

