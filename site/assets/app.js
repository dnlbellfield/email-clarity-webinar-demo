const page = document.body.dataset.page || "unknown";
const sequenceEndpoint = "/api/demo-sequence";
const allowedEvents = new Set([
  "demo_sequence_cta_click",
  "demo_sequence_request",
  "demo_sequence_confirmation_view",
  "demo_sequence_confirmed",
  "demo_email_preview",
  "demo_project_cta_click"
]);

let sequenceConfig = {
  mode: "inactive",
  configuredMode: "inactive",
  configurationReady: true,
  turnstileRequired: false,
  turnstileSiteKey: ""
};
let turnstileToken = "";
let turnstileWidgetId = null;

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

function activeDeliveryMode(value) {
  return value === "test" || value === "public" ? value : "inactive";
}

function updateModeCopy() {
  const note = document.querySelector("[data-sequence-mode-note]");
  if (note) {
    if (sequenceConfig.configuredMode !== "inactive" && !sequenceConfig.configurationReady) {
      note.innerHTML = "<strong>Current status:</strong> Controlled delivery is selected, but the server configuration is incomplete. No request will be sent.";
    } else if (sequenceConfig.mode === "test") {
      note.innerHTML = "<strong>Controlled test:</strong> Delivery is available only to explicitly approved test addresses.";
    } else if (sequenceConfig.mode === "public") {
      note.innerHTML = "<strong>Public delivery:</strong> Confirm your address to begin the three-email demonstration sequence.";
    }
  }

  const confirmedStatus = document.querySelector("[data-confirmed-status]");
  if (confirmedStatus) {
    confirmedStatus.innerHTML = sequenceConfig.mode === "test"
      ? "<strong>Controlled test:</strong> Brevo recorded the confirmation-link click before sending the sequence."
      : sequenceConfig.mode === "public"
        ? "<strong>Live sequence:</strong> Brevo recorded the confirmation-link click before sending the sequence."
        : "<strong>Current local status:</strong> this page is reserved for the approved Brevo confirmation link. Delivery is not active.";
  }
}

async function getSequenceConfig() {
  try {
    const response = await fetch(sequenceEndpoint, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("configuration_unavailable");
    const data = await response.json();
    sequenceConfig = {
      mode: activeDeliveryMode(data.mode),
      configuredMode: ["inactive", "test", "public"].includes(data.configuredMode) ? data.configuredMode : "inactive",
      configurationReady: data.configurationReady === true,
      turnstileRequired: data.turnstileRequired === true,
      turnstileSiteKey: typeof data.turnstileSiteKey === "string" ? data.turnstileSiteKey : ""
    };
  } catch {
    sequenceConfig = { ...sequenceConfig, configurationReady: sequenceConfig.configuredMode === "inactive" };
  }
  updateModeCopy();

  const confirmationMarker = new URLSearchParams(window.location.search).get("confirmation");
  if ((sequenceConfig.mode === "test" || sequenceConfig.mode === "public")
    && page === "sequence_confirmed"
    && confirmationMarker === "brevo") {
    // This event is a PII-free page-arrival signal. Brevo's link-click step is
    // the authoritative double-opt-in record and controls the automation.
    track("demo_sequence_confirmed", {
      confirmation_method: "brevo_link",
      delivery_mode: sequenceConfig.mode
    });
  }
  return sequenceConfig;
}

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-turnstile-script]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.turnstile), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = "true";
    script.addEventListener("load", () => resolve(window.turnstile), { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.append(script);
  });
}

async function initTurnstile() {
  if (!sequenceConfig.turnstileRequired || !sequenceConfig.turnstileSiteKey) return;
  const wrapper = document.querySelector("[data-turnstile-wrap]");
  const container = document.querySelector("[data-turnstile]");
  if (!wrapper || !container) return;
  wrapper.hidden = false;
  const turnstile = await loadTurnstile();
  turnstileWidgetId = turnstile.render(container, {
    sitekey: sequenceConfig.turnstileSiteKey,
    action: "demo_sequence",
    theme: "light",
    callback(token) { turnstileToken = token; },
    "expired-callback"() { turnstileToken = ""; },
    "error-callback"() { turnstileToken = ""; }
  });
}

function resetTurnstile() {
  turnstileToken = "";
  if (window.turnstile && turnstileWidgetId != null) window.turnstile.reset(turnstileWidgetId);
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

function initSequenceForm(configurationPromise) {
  const form = document.querySelector("[data-sequence-form]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await configurationPromise;
    if (!validate(form)) {
      document.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    const status = document.querySelector("[data-form-status]");
    if (sequenceConfig.configuredMode !== "inactive" && !sequenceConfig.configurationReady) {
      status.textContent = "The controlled email test is not fully configured yet.";
      status.focus();
      return;
    }
    if (sequenceConfig.turnstileRequired && !turnstileToken) {
      status.textContent = "Complete the security check before submitting.";
      status.focus();
      return;
    }

    button.disabled = true;
    button.textContent = "Preparing the sequence…";
    status.textContent = "Validating your request.";
    let result = { success: true, delivery: "inactive" };
    try {
      const response = await fetch(sequenceEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email: form.elements.email.value.trim(),
          firstName: form.elements.firstName.value.trim(),
          consent: form.elements.sequenceConsent.checked,
          turnstileToken
        })
      });
      const responseBody = await response.json();
      if (!response.ok) throw new Error(responseBody.message || "The request could not be validated.");
      result = responseBody;
    } catch (error) {
      if (sequenceConfig.mode !== "inactive") {
        status.textContent = error.message || "The request could not be completed. Please try again.";
        button.disabled = false;
        button.textContent = "Receive the three-email sequence";
        resetTurnstile();
        status.focus();
        return;
      }
    }

    const delivery = activeDeliveryMode(result.delivery);
    sessionStorage.setItem("commonlight_sequence_delivery", delivery);
    track("demo_sequence_request", { delivery_mode: delivery });
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
  const delivery = activeDeliveryMode(sessionStorage.getItem("commonlight_sequence_delivery"));
  element.textContent = delivery === "test" || delivery === "public"
    ? "Check your inbox for the Email Clarity confirmation message. The sequence will begin only after you confirm your address."
    : "This local request was validated only. No details were stored and no email was sent.";
  track("demo_sequence_confirmation_view", { delivery_mode: delivery });
}

window.dataLayer = window.dataLayer || [];
const configurationPromise = getSequenceConfig();
initSequenceForm(configurationPromise);
initInteractiveTracking();
initConfirmation();
configurationPromise.then(initTurnstile).catch(() => {
  const status = document.querySelector("[data-form-status]");
  if (status) status.textContent = "The security check could not load. Refresh the page and try again.";
});
if (new URLSearchParams(window.location.search).get("campaign_source") === "promotional_email") {
  track("demo_sequence_cta_click", { placement: "promotional_email" });
}
if (new URLSearchParams(window.location.search).get("campaign_source") === "project_cta") {
  track("demo_project_cta_click", { placement: "follow_up_email" });
}
