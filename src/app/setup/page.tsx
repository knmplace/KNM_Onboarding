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
      <div className="theme-card w-full max-w-md p-8">

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">ADOB Setup</h1>
          <p className="text-sm theme-text-muted mt-1">First-run configuration</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8 text-xs theme-text-soft">
          <span className={step === "pin" ? "font-semibold" : ""} style={step === "pin" ? { color: "var(--accent)" } : {}}>1. Verify</span>
          <span>→</span>
          <span className={step === "credentials" ? "font-semibold" : ""} style={step === "credentials" ? { color: "var(--accent)" } : {}}>2. Create Account</span>
          <span>→</span>
          <span className={step === "complete" ? "font-semibold" : ""} style={step === "complete" ? { color: "var(--accent)" } : {}}>3. Launch</span>
        </div>

        {/* ── Step 1: PIN ── */}
        {step === "pin" && (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <p className="text-sm theme-text-muted">
              Enter the Setup PIN you chose during installation.
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

        {/* ── Step 2: Admin account ── */}
        {step === "credentials" && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <p className="text-sm theme-text-muted">
              Create your admin account. You can configure SMTP, WordPress, and other settings after logging in.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>First Name</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputClass} autoFocus />
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
                Password <span className="text-xs font-normal theme-text-soft">(min 8 characters)</span>
              </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className={inputClass} autoComplete="new-password" />
            </div>
            <div>
              <label className={labelClass}>Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={inputClass} autoComplete="new-password" />
            </div>

            {saveError && (
              <p className="text-sm" style={{ color: "var(--danger-text)" }}>{saveError}</p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="theme-button theme-button--primary w-full py-2 disabled:opacity-50"
            >
              {saving ? "Creating account..." : "Create Account & Continue"}
            </button>
          </form>
        )}

        {/* ── Step 3: Launch ── */}
        {step === "complete" && (
          <div className="space-y-4 text-center">
            <div className="text-4xl" style={{ color: "var(--success-text, #16a34a)" }}>✓</div>
            <p className="font-semibold">Account created!</p>
            <p className="text-sm theme-text-muted">
              Click below to restart the app and log in. This takes about 30 seconds.
            </p>
            {restarting ? (
              <div className="text-sm theme-text-muted animate-pulse">
                Restarting… waiting for app to come back online…
              </div>
            ) : (
              <button onClick={handleRestart} className="theme-button theme-button--primary w-full py-2">
                Restart & Go to Login
              </button>
            )}
            <p className="text-xs theme-text-soft">
              After restart, log in with the email and password you just created. A getting started checklist will guide you through the remaining configuration.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
