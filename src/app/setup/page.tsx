"use client";

import { useState, useEffect } from "react";

type SetupStatus = {
  required: boolean;
  missingFields: string[];
};

type Step = "pin" | "credentials" | "complete";

const FIELD_LABELS: Record<string, string> = {
  WORDPRESS_URL: "WordPress Site URL",
  WORDPRESS_USERNAME: "WordPress Username",
  WORDPRESS_APP_PASSWORD: "WordPress Application Password",
  SMTP_HOST: "SMTP Host",
  SMTP_PORT: "SMTP Port",
  SMTP_USERNAME: "SMTP Username",
  SMTP_PASSWORD: "SMTP Password",
  SMTP_FROM_EMAIL: "SMTP From Email",
  SMTP_FROM_NAME: "SMTP From Name",
  N8N_URL: "n8n Instance URL",
  N8N_API_KEY: "n8n API Key",
  ABSTRACT_API_KEY: "Abstract API Key (email validation)",
  SUPPORT_EMAIL: "Support Email Address",
  ACCOUNT_LOGIN_URL: "Account Login URL",
};

const PASSWORD_FIELDS = new Set([
  "WORDPRESS_APP_PASSWORD",
  "SMTP_PASSWORD",
  "N8N_API_KEY",
  "ABSTRACT_API_KEY",
]);

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
        data.missingFields.forEach((f) => { initial[f] = ""; });
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
    // Wait for restart then poll until app is back up
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">ADOB Setup</h1>
          <p className="text-sm text-gray-500 mt-1">First-run configuration wizard</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8 text-xs text-gray-400">
          <span className={step === "pin" ? "font-semibold text-blue-600" : ""}>1. Verify</span>
          <span>→</span>
          <span className={step === "credentials" ? "font-semibold text-blue-600" : ""}>2. Configure</span>
          <span>→</span>
          <span className={step === "complete" ? "font-semibold text-blue-600" : ""}>3. Launch</span>
        </div>

        {step === "pin" && (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">
              Enter the 8-character setup PIN that was displayed at the end of{" "}
              <code className="bg-gray-100 px-1 rounded text-xs">deploy.sh</code>.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Setup PIN
              </label>
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value.toUpperCase())}
                maxLength={8}
                placeholder="XXXXXXXX"
                disabled={pinLocked}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-lg tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            {pinError && (
              <p className="text-sm text-red-600">{pinError}</p>
            )}
            <button
              type="submit"
              disabled={pin.length < 8 || pinLocked}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Verify PIN
            </button>
          </form>
        )}

        {step === "credentials" && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">
              {missingFields.length === 0
                ? "All credentials are configured. Click Launch to start."
                : `Fill in the ${missingFields.length} missing credential(s) below. You can leave optional fields blank and configure them later in the Sites settings.`}
            </p>
            {missingFields.map((field) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {FIELD_LABELS[field] || field}
                </label>
                <input
                  type={PASSWORD_FIELDS.has(field) ? "password" : "text"}
                  value={credentials[field] || ""}
                  onChange={(e) =>
                    setCredentials((prev) => ({ ...prev, [field]: e.target.value }))
                  }
                  placeholder={`Enter ${FIELD_LABELS[field] || field}`}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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

        {step === "complete" && (
          <div className="space-y-4 text-center">
            <div className="text-4xl">✓</div>
            <p className="text-sm text-gray-600">
              Credentials saved. The app will now restart to apply the configuration.
              This takes about 30 seconds.
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
              After restart you will be redirected to the login page.
              Use your WordPress admin username and Application Password to log in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
