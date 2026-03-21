"use client";

import { useState, useEffect } from "react";

type SetupStatus = {
  required: boolean;
};

type Step = "pin" | "credentials" | "complete";

export default function SetupPage() {
  const [step, setStep] = useState<Step>("pin");

  // ── PIN step ──────────────────────────────────────────────────────────────
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLocked, setPinLocked] = useState(false);

  // ── Credentials step ──────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("465");
  const [smtpSecure, setSmtpSecure] = useState("true");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // ── Complete step ─────────────────────────────────────────────────────────
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    if (step !== "pin") return;
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data: SetupStatus) => {
        if (!data.required) window.location.href = "/login";
      })
      .catch(() => {});
  }, [step]);

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
    setSaveError("");

    if (password !== confirmPassword) {
      setSaveError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setSaveError("Password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/setup/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        admin: { firstName, lastName, email, password },
        smtp: { smtpHost, smtpPort, smtpSecure, smtpUsername, smtpPassword, smtpFromEmail, smtpFromName },
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaveError(data.error || "Failed to save. Please try again.");
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
          .then(() => { clearInterval(poll); window.location.href = "/login"; })
          .catch(() => {});
      }, 2000);
    }, 3000);
  }

  const inputClass = "theme-input px-3 py-2 text-sm w-full";
  const labelClass = "block text-sm font-medium theme-text-muted mb-1";

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg)" }}>
      <div className="theme-card w-full max-w-lg p-8">

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">ADOB Setup</h1>
          <p className="text-sm theme-text-muted mt-1">First-run configuration wizard</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8 text-xs theme-text-soft">
          <span className={step === "pin" ? "font-semibold text-blue-600" : ""}>1. Verify</span>
          <span>{"→"}</span>
          <span className={step === "credentials" ? "font-semibold text-blue-600" : ""}>2. Configure</span>
          <span>{"→"}</span>
          <span className={step === "complete" ? "font-semibold text-blue-600" : ""}>3. Launch</span>
        </div>

        {/* ── Step 1: PIN ── */}
        {step === "pin" && (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <p className="text-sm theme-text-muted">
              Enter the Setup PIN you chose during{" "}
              <code className="px-1 rounded text-xs" style={{ background: "var(--panel-strong)" }}>
                deploy.sh
              </code>{" "}
              installation.
            </p>
            <div>
              <label className={labelClass}>Setup PIN</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter your setup PIN"
                disabled={pinLocked}
                className={inputClass}
                autoFocus
              />
            </div>
            {pinError && <p className="text-sm" style={{ color: "var(--danger-text)" }}>{pinError}</p>}
            <button
              type="submit"
              disabled={pin.length < 6 || pinLocked}
              className="theme-button theme-button--primary w-full py-2 disabled:opacity-50"
            >
              Verify PIN
            </button>
          </form>
        )}

        {/* ── Step 2: Admin account + SMTP ── */}
        {step === "credentials" && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-6">
            <p className="text-sm theme-text-muted">
              Create your admin account and configure outgoing email. You can add WordPress sites after logging in.
            </p>

            {/* Admin account */}
            <div className="space-y-4">
              <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <h2 className="text-sm font-semibold">Admin Account</h2>
                <p className="text-xs theme-text-muted mt-0.5">
                  This will be the owner account for this ADOB installation.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>First Name</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Last Name</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} autoComplete="email" />
              </div>
              <div>
                <label className={labelClass}>
                  Password{" "}
                  <span className="text-xs font-normal theme-text-soft">(min 8 characters)</span>
                </label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className={inputClass} autoComplete="new-password" />
              </div>
              <div>
                <label className={labelClass}>Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={inputClass} autoComplete="new-password" />
              </div>
            </div>

            {/* SMTP */}
            <div className="space-y-4">
              <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <h2 className="text-sm font-semibold">Email Sending (SMTP)</h2>
                <p className="text-xs theme-text-muted mt-0.5">
                  Used to send onboarding emails to users.{" "}
                  <span className="theme-text-soft">Can be configured later.</span>
                </p>
              </div>
              <div>
                <label className={labelClass}>
                  SMTP Host{" "}
                  <span className="text-xs font-normal theme-text-soft">(optional)</span>
                </label>
                <input type="text" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Port</label>
                  <input type="text" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="465" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Secure (SSL)</label>
                  <select value={smtpSecure} onChange={(e) => setSmtpSecure(e.target.value)} className={inputClass}>
                    <option value="true">Yes (SSL/TLS)</option>
                    <option value="false">No (STARTTLS)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>SMTP Username</label>
                <input type="text" value={smtpUsername} onChange={(e) => setSmtpUsername(e.target.value)} placeholder="you@yourdomain.com" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>SMTP Password</label>
                <input type="password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>From Email</label>
                <input type="email" value={smtpFromEmail} onChange={(e) => setSmtpFromEmail(e.target.value)} placeholder="onboarding@yourdomain.com" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>
                  From Name{" "}
                  <span className="text-xs font-normal theme-text-soft">(optional)</span>
                </label>
                <input type="text" value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)} placeholder="ACME Onboarding" className={inputClass} />
              </div>
            </div>

            {saveError && (
              <p className="text-sm" style={{ color: "var(--danger-text)" }}>{saveError}</p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="theme-button theme-button--primary w-full py-2 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Create Account & Continue"}
            </button>
          </form>
        )}

        {/* ── Step 3: Launch ── */}
        {step === "complete" && (
          <div className="space-y-4 text-center">
            <div className="text-4xl text-green-600">✓</div>
            <p className="text-sm theme-text-muted">
              Admin account created. The app will now restart to apply configuration — this takes about 30 seconds.
            </p>
            {restarting ? (
              <div className="text-sm theme-text-muted animate-pulse">
                Restarting… waiting for app to come back up…
              </div>
            ) : (
              <button onClick={handleRestart} className="theme-button theme-button--success w-full py-2">
                Restart & Launch ADOB
              </button>
            )}
            <p className="text-xs theme-text-soft">
              After restart you will be redirected to the login page. Log in with the email and password you just created.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
