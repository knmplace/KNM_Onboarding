"use client";

import { useState, useEffect } from "react";

type SetupStatus = {
  required: boolean;
  missingFields: string[];
};

type Step = "pin" | "credentials" | "complete";

// Field metadata: label, helper text, optional flag, group
const FIELD_META: Record<
  string,
  { label: string; help: string; optional?: boolean; group: "app" | "site" | "smtp" }
> = {
  // ── App-level settings ────────────────────────────────────────────────────
  SUPPORT_EMAIL: {
    label: "Support Email Address",
    help: "The email address shown to users when they need help (e.g. support@yourdomain.com).",
    group: "app",
  },
  ACCOUNT_LOGIN_URL: {
    label: "Account Login URL",
    help: "The login URL shown to users in onboarding emails — typically your WordPress site's login page (e.g. https://yoursite.com/wp-login.php).",
    group: "app",
  },
  N8N_URL: {
    label: "n8n Instance URL",
    help: "URL of your n8n automation instance (e.g. http://localhost:5678/). Used to trigger onboarding workflows.",
    optional: true,
    group: "app",
  },
  N8N_API_KEY: {
    label: "n8n API Key",
    help: "API key from your n8n instance. In n8n: Settings → API Keys → Create. Required if n8n URL is set.",
    optional: true,
    group: "app",
  },
  ABSTRACT_API_KEY: {
    label: "Abstract API Key",
    help: "Optional. Used to validate email addresses during onboarding. Get a free key at abstractapi.com. The app works without it.",
    optional: true,
    group: "app",
  },
  // ── First WordPress site connection ───────────────────────────────────────
  WORDPRESS_URL: {
    label: "WordPress Site URL",
    help: "The URL of your WordPress site (e.g. https://yoursite.com). This is the first site ADOB will manage.",
    group: "site",
  },
  WORDPRESS_USERNAME: {
    label: "WordPress Admin Username",
    help: "Your WordPress administrator username. This is used to connect ADOB to your WordPress site's user management.",
    group: "site",
  },
  WORDPRESS_APP_PASSWORD: {
    label: "WordPress Application Password",
    help: "An Application Password (not your login password). Create one in WordPress: Users → Your Profile → Application Passwords → Add New.",
    group: "site",
  },
  // ── Email sending (SMTP) ──────────────────────────────────────────────────
  SMTP_HOST: {
    label: "SMTP Host",
    help: "Your outgoing mail server hostname (e.g. smtp.gmail.com or mail.yourdomain.com).",
    group: "smtp",
  },
  SMTP_USERNAME: {
    label: "SMTP Username",
    help: "Your SMTP account username — usually your full email address.",
    group: "smtp",
  },
  SMTP_PASSWORD: {
    label: "SMTP Password",
    help: "Your SMTP account password or app-specific password.",
    group: "smtp",
  },
  SMTP_FROM_EMAIL: {
    label: "From Email Address",
    help: "The email address that onboarding emails will be sent from (e.g. onboarding@yourdomain.com).",
    group: "smtp",
  },
  SMTP_FROM_NAME: {
    label: "From Name",
    help: 'The display name shown on outgoing emails (e.g. "ACME Onboarding").',
    optional: true,
    group: "smtp",
  },
};

const PASSWORD_FIELDS = new Set([
  "WORDPRESS_APP_PASSWORD",
  "SMTP_PASSWORD",
  "N8N_API_KEY",
  "ABSTRACT_API_KEY",
]);

const GROUP_LABELS: Record<string, { title: string; description: string }> = {
  app: {
    title: "Application Settings",
    description:
      "These settings configure how ADOB contacts users and connects to your automation tools.",
  },
  site: {
    title: "First WordPress Site",
    description:
      "Connect your first WordPress site. ADOB uses this to manage user accounts. You can add more sites after setup.",
  },
  smtp: {
    title: "Email Sending (SMTP)",
    description:
      "ADOB sends onboarding emails to new users. Enter your outgoing mail server details here.",
  },
};

export default function SetupPage() {
  const [step, setStep] = useState<Step>("pin");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLocked, setPinLocked] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data: SetupStatus) => {
        if (!data.required) {
          window.location.href = "/";
          return;
        }
        setMissingFields(data.missingFields);
        const initial: Record<string, string> = {};
        data.missingFields.forEach((f) => {
          initial[f] = "";
        });
        setCredentials(initial);
      })
      .catch(() => {});
  }, []);

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pinLocked) return;
    setPinError("");

    const res = await fetch("/api/setup/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    if (res.status === 429) {
      setPinLocked(true);
      setPinError("Too many attempts. Try again in 15 minutes.");
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setPinError(data.error || "Incorrect PIN. Please try again.");
      return;
    }
    setStep("credentials");
  }

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");

    const res = await fetch("/api/setup/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credentials }),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaveError(data.error || "Failed to save credentials.");
      return;
    }
    setStep("complete");
  }

  async function handleRestart() {
    setRestarting(true);
    await fetch("/api/setup/restart", { method: "POST" }).catch(() => {});
    setTimeout(() => {
      const poll = setInterval(() => {
        fetch("/api/auth/session")
          .then(() => {
            clearInterval(poll);
            window.location.href = "/login";
          })
          .catch(() => {});
      }, 2000);
    }, 3000);
  }

  // Group missing fields by their category
  const fieldsByGroup: Record<string, string[]> = { app: [], site: [], smtp: [] };
  missingFields.forEach((f) => {
    const group = FIELD_META[f]?.group ?? "app";
    fieldsByGroup[group].push(f);
  });
  const activeGroups = (["app", "site", "smtp"] as const).filter(
    (g) => fieldsByGroup[g].length > 0
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-lg p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">ADOB Setup</h1>
          <p className="text-sm text-gray-500 mt-1">First-run configuration wizard</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8 text-xs text-gray-400">
          <span className={step === "pin" ? "font-semibold text-blue-600" : ""}>1. Verify</span>
          <span>→</span>
          <span className={step === "credentials" ? "font-semibold text-blue-600" : ""}>
            2. Configure
          </span>
          <span>→</span>
          <span className={step === "complete" ? "font-semibold text-blue-600" : ""}>
            3. Launch
          </span>
        </div>

        {/* ── Step 1: PIN ─────────────────────────────────────────────────── */}
        {step === "pin" && (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">
              Enter the Setup PIN you chose during{" "}
              <code className="bg-gray-100 px-1 rounded text-xs">deploy.sh</code> installation.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Setup PIN</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter your setup PIN"
                disabled={pinLocked}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            {pinError && <p className="text-sm text-red-600">{pinError}</p>}
            <button
              type="submit"
              disabled={pin.length < 6 || pinLocked}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Verify PIN
            </button>
          </form>
        )}

        {/* ── Step 2: Credentials ──────────────────────────────────────────── */}
        {step === "credentials" && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-6">
            {missingFields.length === 0 ? (
              <p className="text-sm text-gray-600">
                All credentials are already configured. Click Save &amp; Continue to proceed.
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                Fill in the details below to complete your ADOB installation. Fields marked{" "}
                <span className="text-gray-400 text-xs">(optional)</span> can be left blank and
                configured later.
              </p>
            )}

            {activeGroups.map((group) => (
              <div key={group} className="space-y-4">
                {/* Group heading */}
                <div className="border-t border-gray-100 pt-4">
                  <h2 className="text-sm font-semibold text-gray-800">
                    {GROUP_LABELS[group].title}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">{GROUP_LABELS[group].description}</p>
                </div>

                {fieldsByGroup[group].map((field) => {
                  const meta = FIELD_META[field];
                  const label = meta?.label ?? field;
                  const help = meta?.help;
                  const optional = meta?.optional;
                  return (
                    <div key={field}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {label}
                        {optional && (
                          <span className="ml-1.5 text-xs font-normal text-gray-400">
                            (optional)
                          </span>
                        )}
                      </label>
                      {help && <p className="text-xs text-gray-500 mb-1.5">{help}</p>}
                      <input
                        type={PASSWORD_FIELDS.has(field) ? "password" : "text"}
                        value={credentials[field] || ""}
                        onChange={(e) =>
                          setCredentials((prev) => ({ ...prev, [field]: e.target.value }))
                        }
                        placeholder={optional ? "Leave blank to configure later" : ""}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  );
                })}
              </div>
            ))}

            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save & Continue"}
            </button>
          </form>
        )}

        {/* ── Step 3: Complete ─────────────────────────────────────────────── */}
        {step === "complete" && (
          <div className="space-y-4 text-center">
            <div className="text-4xl text-green-600">✓</div>
            <p className="text-sm text-gray-600">
              Credentials saved. The app will now restart to apply the configuration. This takes
              about 30 seconds.
            </p>
            {restarting ? (
              <div className="text-sm text-gray-500 animate-pulse">
                Restarting… waiting for app to come back up…
              </div>
            ) : (
              <button
                onClick={handleRestart}
                className="w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700"
              >
                Restart & Launch ADOB
              </button>
            )}
            <p className="text-xs text-gray-400">
              After restart you will be redirected to the login page. Log in with your WordPress
              admin username and the Application Password you entered above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
