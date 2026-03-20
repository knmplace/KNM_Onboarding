"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function proxied(url: string | null | undefined): string | null {
  if (!url) return null;
  return `/api/tools/proxy-image?url=${encodeURIComponent(url)}`;
}

function hex(color: string): string {
  // Ensure it starts with # and is a valid 3 or 6 digit hex; fallback to navy
  return /^#[0-9a-fA-F]{3,6}$/.test(color) ? color : "#1a3a6e";
}

function darken(color: string, amount = 25): string {
  const h = hex(color).replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function lighten(color: string, amount = 220): string {
  const h = hex(color).replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function GuidePreviewContent() {
  const params = useSearchParams();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [htmlSource, setHtmlSource] = useState<string>("");

  useEffect(() => {
    // After render, grab the .wrapper innerHTML and build a complete standalone HTML file
    if (!wrapperRef.current) return;
    const styleEl = document.querySelector("style[data-guide]") as HTMLStyleElement | null;
    const css = styleEl?.textContent ?? "";
    const body = wrapperRef.current.innerHTML;
    const full = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Secure Onboarding Guide</title>
  <style>${css}</style>
</head>
<body>
<div class="wrapper">
${body}
</div>
</body>
</html>`;
    setHtmlSource(full);
  }, [params]); // re-run if params change
  const siteName = params.get("name") || "Your Site";
  const primaryColor = hex(params.get("color") || "#1a3a6e");
  const supportEmail = params.get("email") || `support@${params.get("url") ? new URL(params.get("url")!).hostname : "yoursite.com"}`;
  const loginUrl = params.get("login") || `${params.get("url") || "https://yoursite.com"}/login`;
  const logoUrl = params.get("logo") || null;
  const iconUrl = params.get("icon") || null;
  const logoBrightness = (params.get("logoBrightness") || "unknown") as "light" | "dark" | "unknown";
  const iconBrightness  = (params.get("iconBrightness")  || "unknown") as "light" | "dark" | "unknown";
  const siteUrl = params.get("url") || "https://yoursite.com";
  const logoLetter = siteName.charAt(0).toUpperCase();
  const year = new Date().getFullYear();
  const accentLight = lighten(primaryColor, 235);
  const heroGradient = `linear-gradient(135deg, ${primaryColor} 0%, ${darken(primaryColor, 30)} 100%)`;

  // Always prefer logoUrl (actual site logo) — favicon only as last resort
  // All images routed through proxy to avoid CORS blocks
  const heroLogoImg  = proxied(logoUrl);              // large centered logo at top
  const badgeImg     = proxied(logoUrl || iconUrl);   // small badge in doc header
  const brandBarImg  = proxied(logoUrl || iconUrl);   // 32px in email brand bars

  // Contrast-aware styling for logo display areas
  // "light" = logo pixels are light/white — the logo itself has a light background
  //           → no container needed, the white blends into the page; just a subtle border
  // "dark"  = logo pixels are dark — logo may be on transparent or dark bg
  //           → light gray container so it stands out on white page areas
  // "unknown" → minimal border only, no background assumption
  const effectiveBrightness = logoBrightness !== "unknown" ? logoBrightness : iconBrightness;
  const logoHasBg  = effectiveBrightness === "light";  // logo already has its own bg — show as-is
  const logoBg     = effectiveBrightness === "dark" ? "#f3f4f6" : "transparent";
  const logoBorder = logoHasBg ? "1px solid #e5e7eb" : "none";  // subtle border for white-bg logos

  return (
    <>
      <style data-guide>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: #f4f6f9;
          color: #1a1a2e;
          font-size: 15px;
          line-height: 1.7;
        }
        @media print {
          body { background: #fff; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          .card { box-shadow: none !important; border: 1px solid #dde !important; }
          .print-section { break-inside: avoid; }
        }
        .wrapper { max-width: 860px; margin: 0 auto; padding: 40px 20px 80px; }
        .print-bar {
          background: #fff; border-radius: 12px; padding: 16px 24px;
          margin-bottom: 28px; display: flex; align-items: center;
          justify-content: space-between; box-shadow: 0 2px 12px rgba(0,0,0,.07);
        }
        .print-bar p { font-size: 13px; color: #666; }
        .btn-print {
          color: #fff; border: none; border-radius: 8px;
          padding: 10px 22px; font-size: 13px; font-weight: 600; cursor: pointer;
        }
        .doc-header {
          border-radius: 16px; padding: 48px 48px 40px;
          margin-bottom: 40px; position: relative; overflow: hidden;
        }
        .doc-header::after {
          content: ""; position: absolute; right: -40px; top: -40px;
          width: 260px; height: 260px; border-radius: 50%;
          background: rgba(255,255,255,0.06);
        }
        .doc-header .badge {
          display: inline-flex; align-items: center; gap: 10px;
          background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.3);
          border-radius: 24px; padding: 6px 18px 6px 8px;
          font-size: 11px; font-weight: 600; letter-spacing: .08em;
          text-transform: uppercase; margin-bottom: 16px;
        }
        .doc-header h1 { font-size: 34px; font-weight: 700; line-height: 1.2; margin-bottom: 12px; }
        .doc-header p  { font-size: 16px; opacity: .85; max-width: 560px; }
        .doc-header .meta { margin-top: 28px; font-size: 12px; opacity: .65; text-transform: uppercase; letter-spacing: .07em; }
        .card { background: #fff; border-radius: 14px; box-shadow: 0 2px 16px rgba(0,0,0,.07); padding: 36px 40px; margin-bottom: 28px; }
        .card h2 { font-size: 20px; font-weight: 700; margin-bottom: 10px; }
        .card h3 { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
        .card p  { color: #444; margin-bottom: 14px; }
        .card p:last-child { margin-bottom: 0; }
        .section-label { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; font-weight: 700; margin-bottom: 8px; }
        /* Steps */
        .steps { list-style: none; }
        .step { display: flex; gap: 20px; margin-bottom: 32px; position: relative; }
        .step:not(:last-child)::before { content: ""; position: absolute; left: 20px; top: 44px; width: 2px; bottom: -20px; background: #d0ddf0; }
        .step-num { flex-shrink: 0; width: 42px; height: 42px; border-radius: 50%; color: #fff; font-weight: 700; font-size: 16px; display: flex; align-items: center; justify-content: center; position: relative; z-index: 1; }
        .step-body h3 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
        .step-body p  { color: #555; font-size: 14px; }
        /* Timeline */
        .timeline { display: flex; gap: 0; margin: 24px 0; overflow-x: auto; }
        .tl-item { flex: 1; text-align: center; position: relative; }
        .tl-item:not(:last-child)::after { content: ""; position: absolute; top: 18px; left: 50%; width: 100%; height: 2px; background: #c8d4ea; }
        .tl-dot { width: 38px; height: 38px; border-radius: 50%; border: 3px solid; background: #fff; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; position: relative; z-index: 1; }
        .tl-dot.active { color: #fff !important; }
        .tl-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
        .tl-sub   { font-size: 11px; color: #888; margin-top: 3px; }
        /* Email mockup */
        .email-mockup-outer { background: #e8ecf4; border-radius: 12px; padding: 24px 24px 18px; margin: 20px 0; }
        .email-mockup-outer .label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #6b7a99; font-weight: 600; margin-bottom: 10px; }
        .email-chrome { background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,.12); }
        .email-chrome-bar { background: #f0f2f5; padding: 10px 16px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #dde3ed; }
        .dot { width: 10px; height: 10px; border-radius: 50%; }
        .email-chrome-meta { padding: 14px 20px 10px; border-bottom: 1px solid #eef1f7; }
        .email-chrome-meta .from { font-size: 13px; font-weight: 600; color: #222; }
        .email-chrome-meta .subject { font-size: 12px; color: #666; margin-top: 2px; }
        .email-body { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; }
        .email-brand-bar { background: #1e1e2e; padding: 12px 24px; display: flex; align-items: center; gap: 14px; }
        .logo-box { width: 56px; height: 56px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 18px; overflow: hidden; flex-shrink: 0; }
        .email-brand-bar span { color: #c8d0e4; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; }
        .email-hero { color: #fff; padding: 28px 32px 22px; }
        .email-hero h2 { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
        .email-hero p  { font-size: 13px; opacity: .8; margin: 0; }
        .email-content { padding: 24px 32px; background: #fff; }
        .email-content p { font-size: 14px; margin-bottom: 12px; color: #444; }
        .email-btn { display: inline-block; color: #fff !important; padding: 12px 28px; border-radius: 7px; font-size: 14px; font-weight: 600; text-decoration: none; margin: 10px 0 16px; }
        .email-info-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        .email-info-table td { padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #eef1f7; }
        .email-info-table td:first-child { color: #888; width: 38%; font-weight: 500; }
        .email-info-table td:last-child { color: #222; font-weight: 600; }
        .email-alert { border-left: 4px solid; border-radius: 0 6px 6px 0; padding: 12px 16px; font-size: 13px; margin: 14px 0; }
        .email-steps-list { list-style: none; margin: 14px 0; padding: 0; }
        .email-steps-list li { display: flex; gap: 12px; font-size: 13px; margin-bottom: 10px; color: #444; }
        .email-steps-list li .num { flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
        .email-footer { background: #f8f9fc; padding: 14px 32px; text-align: center; border-top: 1px solid #eef1f7; }
        .email-footer p { font-size: 11px; color: #aaa; margin: 0; }
        /* Badges */
        .badges { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 20px; }
        .badge-item { border-radius: 10px; padding: 18px 20px; display: flex; gap: 14px; align-items: flex-start; }
        .badge-icon { font-size: 24px; line-height: 1; flex-shrink: 0; }
        .badge-item h4 { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
        .badge-item p  { font-size: 12px; color: #666; margin: 0; }
        /* FAQ */
        .faq-item { border-bottom: 1px solid #edf0f7; padding: 16px 0; }
        .faq-item:last-child { border-bottom: none; }
        .faq-item h4 { font-size: 14px; font-weight: 700; margin-bottom: 6px; }
        .faq-item p  { font-size: 13px; color: #555; margin: 0; }
        /* Callout */
        .callout { border-radius: 12px; padding: 24px 28px; display: flex; gap: 18px; align-items: flex-start; margin: 24px 0; }
        .callout .icon { font-size: 30px; flex-shrink: 0; }
        .callout h3 { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
        .callout p  { font-size: 13px; color: #334; margin: 0; }
        /* Hero logo */
        .hero-logo-block { text-align: center; padding: 24px 0 8px; }
        .hero-logo-block .logo-wrap { display: inline-block; border-radius: 16px; padding: 20px 32px; }
        .hero-logo-block .logo-wrap.no-bg { padding: 8px; border-radius: 12px; }
        .hero-logo-block img { max-width: 450px; max-height: 160px; width: auto; height: auto; object-fit: contain; display: block; }

        /* ── Print / PDF ─────────────────────────────────────────────────── */
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          body { background: #fff; font-size: 11px; line-height: 1.45; }

          /* Remove screen chrome */
          .no-print { display: none !important; }

          /* Wrapper — tighter, full-width */
          .wrapper { max-width: 100%; padding: 0 16px 20px; }

          /* Hero logo — smaller for print */
          .hero-logo-block { padding: 8px 0 4px; }
          .hero-logo-block .logo-wrap { padding: 8px 16px; }
          .hero-logo-block .logo-wrap.no-bg { padding: 4px 8px; }
          .hero-logo-block img { max-width: 200px; max-height: 70px; }

          /* Doc header — tighter padding, smaller text */
          .doc-header { padding: 20px 24px 16px; margin-bottom: 12px; border-radius: 10px; }
          .doc-header h1 { font-size: 20px; margin-bottom: 6px; }
          .doc-header p  { font-size: 11px; }
          .doc-header .meta { margin-top: 10px; font-size: 9px; }
          .doc-header .badge { padding: 3px 10px 3px 5px; font-size: 9px; margin-bottom: 8px; }
          .doc-header .badge img { width: 22px !important; height: 22px !important; }

          /* Cards — compact */
          .card { padding: 12px 16px; margin-bottom: 8px; border-radius: 8px; box-shadow: none !important; border: 1px solid #e0e4ef !important; }
          .card h2 { font-size: 13px; margin-bottom: 4px; }
          .card h3 { font-size: 11px; margin-bottom: 3px; }
          .card p  { font-size: 11px; margin-bottom: 6px; line-height: 1.4; }
          .section-label { font-size: 9px; margin-bottom: 4px; }

          /* No forced page breaks — let content flow */
          .page-break { page-break-before: auto; }

          /* Only break before email examples section to keep mockups together */
          .print-section { break-inside: avoid; }

          /* Timeline — tighter */
          .timeline { margin: 10px 0; }
          .tl-dot { width: 26px; height: 26px; font-size: 10px; margin-bottom: 5px; border-width: 2px; }
          .tl-item:not(:last-child)::after { top: 12px; }
          .tl-label { font-size: 8px; }
          .tl-sub   { font-size: 8px; }

          /* Steps — tighter */
          .step { gap: 10px; margin-bottom: 10px; }
          .step:not(:last-child)::before { left: 14px; top: 32px; bottom: -8px; }
          .step-num { width: 28px; height: 28px; font-size: 11px; }
          .step-body h3 { font-size: 11px; margin-bottom: 2px; }
          .step-body p  { font-size: 10px; line-height: 1.35; }

          /* Email mockups — compact */
          .email-mockup-outer { padding: 8px; margin: 6px 0; border-radius: 6px; }
          .email-mockup-outer .label { font-size: 9px; margin-bottom: 5px; }
          .email-chrome-bar { padding: 5px 10px; }
          .dot { width: 7px; height: 7px; }
          .email-chrome-meta { padding: 7px 12px 6px; }
          .email-chrome-meta .from { font-size: 10px; }
          .email-chrome-meta .subject { font-size: 9px; }
          .email-brand-bar { padding: 8px 14px; gap: 8px; }
          .logo-box { width: 36px; height: 36px; font-size: 13px; border-radius: 6px; }
          .email-brand-bar span { font-size: 9px; }
          .email-hero { padding: 12px 16px 10px; }
          .email-hero h2 { font-size: 13px; margin-bottom: 3px; }
          .email-hero p  { font-size: 10px; }
          .email-content { padding: 10px 16px; }
          .email-content p { font-size: 10px; margin-bottom: 6px; }
          .email-btn { padding: 6px 14px; font-size: 10px; margin: 4px 0 8px; }
          .email-info-table td { padding: 4px 6px; font-size: 10px; }
          .email-alert { padding: 6px 10px; font-size: 10px; margin: 6px 0; }
          .email-steps-list li { font-size: 10px; margin-bottom: 5px; gap: 7px; }
          .email-steps-list li .num { width: 16px; height: 16px; font-size: 9px; }
          .email-footer { padding: 7px 16px; }
          .email-footer p { font-size: 9px; }

          /* Security badges grid — 3 columns in print */
          .badges { grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
          .badge-item { padding: 8px 10px; border-radius: 6px; gap: 8px; }
          .badge-icon { font-size: 16px; }
          .badge-item h4 { font-size: 10px; margin-bottom: 2px; }
          .badge-item p  { font-size: 9px; }

          /* FAQ — tighter */
          .faq-item { padding: 7px 0; }
          .faq-item h4 { font-size: 11px; margin-bottom: 3px; }
          .faq-item p  { font-size: 10px; }
        }
      `}</style>

      <div className="wrapper" ref={wrapperRef}>
        {/* Print bar */}
        <div className="print-bar no-print">
          <p>Branded guide for <strong>{siteName}</strong> — save as PDF using your browser's print dialog.</p>
          <button
            className="btn-print"
            style={{ background: primaryColor }}
            onClick={() => window.print()}
          >
            Save as PDF / Print
          </button>
        </div>

        {/* Centered site logo — contrast-aware background */}
        {heroLogoImg && (
          <div className="hero-logo-block">
            <div
              className={`logo-wrap${logoHasBg ? " no-bg" : ""}`}
              style={{
                background: logoBg,
                border: logoBorder,
              }}
            >
              <img
                src={heroLogoImg}
                alt={`${siteName} logo`}
                onError={(e) => { (e.target as HTMLImageElement).closest(".hero-logo-block")?.remove(); }}
              />
            </div>
          </div>
        )}

        {/* Doc Header */}
        <div className="doc-header" style={{ background: heroGradient, color: "#fff" }}>
          <div className="badge">
            {badgeImg ? (
              <img
                src={badgeImg}
                alt=""
                style={{ width: 36, height: 36, borderRadius: 6, objectFit: "contain", background: logoHasBg ? "#ffffff" : logoBg, border: logoBorder, flexShrink: 0 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <span style={{ width: 36, height: 36, borderRadius: 6, background: "rgba(255,255,255,0.3)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 }}>{logoLetter}</span>
            )}
            User Guide · Secure Onboarding
          </div>
          <h1>What to Expect When You Register</h1>
          <p>A step-by-step walkthrough of the {siteName} secure onboarding process — from signup to full account access — and why each step keeps your account safe.</p>
          <div className="meta">Prepared for new {siteName} members · Version 1.0</div>
        </div>

        {/* Overview */}
        <div className="card print-section">
          <div className="section-label" style={{ color: primaryColor }}>Overview</div>
          <h2 style={{ color: primaryColor }}>What is Secure Onboarding?</h2>
          <p>When you register for a <strong>{siteName}</strong> account, you go through a brief <strong>secure onboarding process</strong> that verifies your identity, validates your email address, and ensures your account is set up correctly from day one.</p>
          <p>This process is designed to protect you — especially if your email has ever appeared in a known data breach — and to ensure that only authorized users gain access. It typically takes <strong>24–48 hours</strong> from registration to full access.</p>

          <div className="timeline">
            {[
              ["1", "You Register", "Instant"],
              ["2", "Email Check", "Automated"],
              ["3", "Admin Review", "24–48 hrs"],
              ["4", "Welcome Email", "On approval"],
              ["5", "Set Password", "You log in"],
              ["6", "Full Access", "You're in!"],
            ].map(([num, label, sub], i) => (
              <div className="tl-item" key={num}>
                <div
                  className={`tl-dot${i < 4 ? " active" : ""}`}
                  style={{
                    borderColor: primaryColor,
                    color: i < 4 ? "#fff" : primaryColor,
                    background: i < 4 ? primaryColor : "#fff",
                  }}
                >
                  {num}
                </div>
                <div className="tl-label" style={{ color: primaryColor }}>{label}</div>
                <div className="tl-sub">{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="card print-section">
          <div className="section-label" style={{ color: primaryColor }}>Step by Step</div>
          <h2 style={{ color: primaryColor }}>Your Onboarding Journey</h2>
          <p style={{ marginBottom: 28 }}>Here's exactly what happens from the moment you submit your registration to {siteName}.</p>

          <ul className="steps">
            {[
              ["You Submit Your Registration", `You fill out the registration form with your name, email address, and any required details. Your ${siteName} account is created and placed in a pending state while a few automated checks run.`],
              ["Automated Email Validation", "Our system immediately checks your email address against several security databases. It verifies the email can receive messages, checks it is not a temporary/disposable address, and — most importantly — checks if it has appeared in any known data breaches. This all happens in seconds with no action required from you."],
              ["If a Breach is Detected — You Get a Heads Up", `If our check finds that your email address has been involved in a public data breach (such as a past security incident at another website), we will send you an automatic security notice. This is a courtesy alert — it does not mean your ${siteName} account has been compromised. See the email example below.`],
              ["Admin Review & Approval", "A member of our team reviews your registration — typically within 24–48 hours. They see the validation summary and confirm that everything looks good before activating your account."],
              ["You Receive Your Welcome & Activation Email", `Once approved, you will receive a welcome email containing a secure link to log in to ${siteName} for the first time. Your account is given a temporary password. You must log in and change this password to complete your setup and gain full access.`],
              ["Log In & Change Your Password", "Click the link in your welcome email, log in with your temporary credentials, and set a strong, unique password. Once your password is changed, your onboarding is complete and you have full access to your account."],
            ].map(([title, body], i) => (
              <li className="step" key={i}>
                <div className="step-num" style={{ background: primaryColor }}>{i + 1}</div>
                <div className="step-body">
                  <h3 style={{ color: primaryColor }}>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Email mockups */}

        <div className="card print-section">
          <div className="section-label" style={{ color: primaryColor }}>Email Examples</div>
          <h2 style={{ color: primaryColor }}>Emails You May Receive</h2>
          <p>Below are examples of the emails you might receive during the {siteName} onboarding process.</p>
        </div>

        {/* Email 1 — Breach Alert */}
        <div className="card print-section">
          <h3 style={{ marginBottom: 4, color: primaryColor }}>Email 1 of 3 — Security Notice (if applicable)</h3>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>Only sent if our automated check finds your email in a known public data breach from another service.</p>
          <div className="email-mockup-outer">
            <div className="label">Inbox Preview</div>
            <div className="email-chrome">
              <div className="email-chrome-bar">
                <div className="dot" style={{ background: "#ff5f57" }} />
                <div className="dot" style={{ background: "#febc2e" }} />
                <div className="dot" style={{ background: "#28c840" }} />
              </div>
              <div className="email-chrome-meta">
                <div className="from">From: Security Team &lt;security@{new URL(siteUrl).hostname}&gt;</div>
                <div className="subject">Subject: Security Notice — Your Email Was Found in a Data Breach</div>
              </div>
              <div className="email-body">
                <div className="email-brand-bar">
                  <div className="logo-box" style={{ background: logoHasBg ? "#ffffff" : logoBg, border: logoBorder }}>
                    {brandBarImg ? <img src={brandBarImg} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={(e) => { (e.target as HTMLImageElement).replaceWith(Object.assign(document.createTextNode(logoLetter))); }} /> : logoLetter}
                  </div>
                  <span>{siteName} — Secure Onboarding</span>
                </div>
                <div className="email-hero" style={{ background: primaryColor }}>
                  <h2>Security Notice</h2>
                  <p>We found something important about your email address</p>
                </div>
                <div className="email-content">
                  <p>Hello <strong>Jane Smith</strong>,</p>
                  <p>During your registration, our automated security system checked your email address against known public data breach records. We found that <strong>jane.smith@email.com</strong> appeared in <strong>3 known data breaches</strong> from other websites.</p>
                  <div className="email-alert" style={{ background: accentLight, borderColor: primaryColor, color: darken(primaryColor, 10) }}>
                    <strong>What does this mean?</strong><br />
                    Your account with {siteName} has <em>not</em> been affected. This means another website had a security incident in the past and your email was part of that exposure.
                  </div>
                  <p><strong>Recent Breach Sources May Include:</strong></p>
                  <table className="email-info-table">
                    <tbody>
                      <tr><td>Service</td><td>LinkedIn (2021), Yahoo (2016), Adobe (2013)</td></tr>
                      <tr><td>Data Types</td><td>Email addresses, hashed passwords, usernames</td></tr>
                      <tr><td>Breaches Found</td><td>3 incidents</td></tr>
                    </tbody>
                  </table>
                  <p style={{ marginTop: 14 }}><strong>We recommend taking these steps:</strong></p>
                  <ul className="email-steps-list">
                    {["Change your passwords on any affected sites, especially if you reuse the same password.", "Use a unique, strong password for each website — a password manager makes this easy.", "Enable two-factor authentication (2FA) wherever possible.", "Check your full exposure at haveibeenpwned.com for a complete history."].map((s, i) => (
                      <li key={i}><span className="num" style={{ background: primaryColor }}>{i + 1}</span><span>{s}</span></li>
                    ))}
                  </ul>
                  <p style={{ color: "#888", fontSize: 12, marginTop: 14 }}>Your registration with {siteName} is unaffected. This is a proactive notice to help you stay secure. If you have questions, contact {supportEmail}.</p>
                </div>
                <div className="email-footer">
                  <p>{siteName} · {supportEmail} · This is an automated security alert.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Email 2 — Welcome */}
        <div className="card print-section">
          <h3 style={{ marginBottom: 4, color: primaryColor }}>Email 2 of 3 — Welcome &amp; Account Activation</h3>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>Sent when your account is approved. Contains your login link and instructions to set your password.</p>
          <div className="email-mockup-outer">
            <div className="label">Inbox Preview</div>
            <div className="email-chrome">
              <div className="email-chrome-bar">
                <div className="dot" style={{ background: "#ff5f57" }} />
                <div className="dot" style={{ background: "#febc2e" }} />
                <div className="dot" style={{ background: "#28c840" }} />
              </div>
              <div className="email-chrome-meta">
                <div className="from">From: Accounts Team &lt;accounts@{new URL(siteUrl).hostname}&gt;</div>
                <div className="subject">Subject: Your {siteName} Account is Approved — Action Required</div>
              </div>
              <div className="email-body">
                <div className="email-brand-bar">
                  <div className="logo-box" style={{ background: logoHasBg ? "#ffffff" : logoBg, border: logoBorder }}>
                    {brandBarImg ? <img src={brandBarImg} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={(e) => { (e.target as HTMLImageElement).replaceWith(Object.assign(document.createTextNode(logoLetter))); }} /> : logoLetter}
                  </div>
                  <span>{siteName} — Secure Onboarding</span>
                </div>
                <div className="email-hero" style={{ background: primaryColor }}>
                  <h2>Welcome — Your Account is Active!</h2>
                  <p>One last step: log in and set your permanent password</p>
                </div>
                <div className="email-content">
                  <p>Hello <strong>Jane Smith</strong>,</p>
                  <p>Great news — your {siteName} account has been reviewed and is now <strong>active</strong>. You can log in right now using the button below.</p>
                  <div className="email-alert" style={{ background: "#fff8e7", borderColor: "#f59e0b", color: "#664d00" }}>
                    <strong>Action Required:</strong> A temporary password has been assigned to your account. You must log in and change it to a permanent password to complete your setup and maintain access.
                  </div>
                  <table className="email-info-table">
                    <tbody>
                      <tr><td>Your Username</td><td>jane.smith@email.com</td></tr>
                      <tr><td>Account Status</td><td>✅ Active</td></tr>
                      <tr><td>Password Required</td><td>Change required at first login</td></tr>
                    </tbody>
                  </table>
                  <div style={{ textAlign: "center", margin: "20px 0" }}>
                    <a href={loginUrl} className="email-btn" style={{ background: primaryColor }}>Log In &amp; Set Your Password →</a>
                  </div>
                  <p>Or copy and paste this link into your browser:<br />
                    <span style={{ color: primaryColor, fontSize: 12 }}>{loginUrl}</span>
                  </p>
                  <p style={{ color: "#888", fontSize: 12, marginTop: 16 }}>If you did not register for this account or have any questions, please contact us at {supportEmail}.</p>
                </div>
                <div className="email-footer">
                  <p>{siteName} · {supportEmail} · This is an automated notification.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Email 3 — Reminder */}
        <div className="card print-section">
          <h3 style={{ marginBottom: 4, color: primaryColor }}>Email 3 of 3 — Friendly Reminder (if needed)</h3>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>Sent automatically if you haven't logged in or changed your password after a few days.</p>
          <div className="email-mockup-outer">
            <div className="label">Inbox Preview</div>
            <div className="email-chrome">
              <div className="email-chrome-bar">
                <div className="dot" style={{ background: "#ff5f57" }} />
                <div className="dot" style={{ background: "#febc2e" }} />
                <div className="dot" style={{ background: "#28c840" }} />
              </div>
              <div className="email-chrome-meta">
                <div className="from">From: Accounts Team &lt;accounts@{new URL(siteUrl).hostname}&gt;</div>
                <div className="subject">Subject: Reminder — Please Complete Your {siteName} Account Setup (Reminder 1)</div>
              </div>
              <div className="email-body">
                <div className="email-brand-bar">
                  <div className="logo-box" style={{ background: logoHasBg ? "#ffffff" : logoBg, border: logoBorder }}>
                    {brandBarImg ? <img src={brandBarImg} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={(e) => { (e.target as HTMLImageElement).replaceWith(Object.assign(document.createTextNode(logoLetter))); }} /> : logoLetter}
                  </div>
                  <span>{siteName} — Secure Onboarding</span>
                </div>
                <div className="email-hero" style={{ background: darken(primaryColor, 20) }}>
                  <h2>Friendly Reminder</h2>
                  <p>Your account is active but setup is not yet complete</p>
                </div>
                <div className="email-content">
                  <p>Hello <strong>Jane Smith</strong>,</p>
                  <p>This is a reminder that your {siteName} account was activated on <strong>March 10, {year}</strong> but your password has not yet been changed from the temporary one.</p>
                  <table className="email-info-table">
                    <tbody>
                      <tr><td>Account Activated</td><td>March 10, {year}</td></tr>
                      <tr><td>Current Status</td><td>⏳ Awaiting password change</td></tr>
                      <tr><td>This Reminder</td><td>#1 of 3</td></tr>
                    </tbody>
                  </table>
                  <div className="email-alert" style={{ background: "#fff0f0", borderColor: "#ef4444", color: "#7f1d1d" }}>
                    <strong>Important:</strong> If setup is not completed, your account may be automatically deactivated for security reasons. Please log in as soon as possible.
                  </div>
                  <div style={{ textAlign: "center", margin: "20px 0" }}>
                    <a href={loginUrl} className="email-btn" style={{ background: primaryColor }}>Complete My Setup Now →</a>
                  </div>
                  <p style={{ color: "#888", fontSize: 12 }}>If you need help, contact {supportEmail}. Reminders are sent automatically as part of the {siteName} secure onboarding process.</p>
                </div>
                <div className="email-footer">
                  <p>{siteName} · © {year} {siteName}. All Rights Reserved.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Benefits */}
        <div className="card print-section">
          <div className="section-label" style={{ color: primaryColor }}>Security Benefits</div>
          <h2 style={{ color: primaryColor }}>Why We Do This — How It Protects You</h2>
          <p>The {siteName} onboarding process is built around real security best practices. Here's what each part does for you:</p>
          <div className="badges">
            {[
              ["🔍", "Email Breach Detection", `We check your email against public breach databases the moment you register with ${siteName}. If your email was exposed in a past security incident anywhere online, you'll know immediately.`],
              ["✅", "Human Approval", "Every account is reviewed by a real team member before activation. This prevents automated signups, bots, and unauthorized access attempts from the start."],
              ["🔑", "Forced Password Reset", "You are never left with a default or shared password. Requiring a password change at first login ensures only you know your credentials from day one."],
              ["⏰", "Automated Reminders", "If life gets busy, our system gently follows up so your account doesn't sit in an insecure half-setup state indefinitely — protecting both you and the platform."],
              ["🛡️", "Email Validation", "We verify your email can actually receive messages and check it isn't a temporary throwaway address — keeping our community genuine and your communications reliable."],
              ["🔔", "Ongoing Breach Monitoring", "Even after onboarding, we periodically re-check emails against new breach databases. If your email appears in a newly discovered breach, we'll alert you proactively."],
            ].map(([icon, title, body]) => (
              <div className="badge-item" key={String(title)} style={{ background: accentLight }}>
                <div className="badge-icon">{icon}</div>
                <div>
                  <h4 style={{ color: primaryColor }}>{title}</h4>
                  <p>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Callout */}
        <div className="callout no-print" style={{ background: accentLight }}>
          <div className="icon">💡</div>
          <div>
            <h3 style={{ color: primaryColor }}>A Note on the Security Breach Alert</h3>
            <p>If you receive a breach notification email from {siteName}, please don't be alarmed. It means another website or service — not ours — had a past security incident that included your email address. We're simply giving you a heads up so you can take action on those other accounts.</p>
          </div>
        </div>

        {/* FAQ */}
        <div className="card print-section">
          <div className="section-label" style={{ color: primaryColor }}>Frequently Asked Questions</div>
          <h2 style={{ color: primaryColor }}>Common Questions</h2>
          {[
            ["How long does approval take?", `Most ${siteName} accounts are reviewed and approved within 24–48 hours during business days. You'll receive an email the moment your account is approved.`],
            ["I received a breach alert — does that mean my new account was hacked?", `No. The breach alert refers to past incidents at other websites, not your account with ${siteName}. We run this check as a courtesy so you can take protective action on those other services.`],
            ["What happens if I don't change my password?", "Our system will send you reminder emails. If setup isn't completed after a period of inactivity, your account may be automatically deactivated as a security precaution. You can always contact us to have it reactivated."],
            ["Why do I need to change my password at first login?", "Temporary passwords are never as secure as one you create yourself. By requiring a password change at first login, we guarantee that only you know your credentials from the very beginning."],
            ["Will I keep receiving breach alert emails after I'm set up?", "Occasionally, yes. Our system runs periodic security checks against updated breach databases. If your email appears in a newly discovered breach, we'll send you one notification (no more than once every 30 days)."],
            ["Is my registration information safe?", `Yes. Your data is stored on a secure, isolated database on a private network. Email validation results are used internally only and are never shared with third parties. Contact ${supportEmail} with any concerns.`],
          ].map(([q, a]) => (
            <div className="faq-item" key={String(q)}>
              <h4 style={{ color: primaryColor }}>{q}</h4>
              <p>{a}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "20px 0", color: "#aaa", fontSize: 12 }}>
          {siteName} Secure Onboarding Guide · © {year} {siteName} · {supportEmail}
        </div>
      </div>

      {/* ── HTML Source Export — hidden from print ── */}
      {htmlSource && (
        <div
          className="no-print"
          style={{
            maxWidth: 860,
            margin: "0 auto 60px",
            padding: "0 20px",
          }}
        >
          <div style={{
            background: "#1e1e2e",
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: "0 4px 24px rgba(0,0,0,.15)",
          }}>
            {/* Panel header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div>
                <span style={{ color: "#c8d0e4", fontFamily: "monospace", fontSize: 13, fontWeight: 600 }}>
                  HTML Source
                </span>
                <span style={{ color: "#6b7a99", fontSize: 12, marginLeft: 12 }}>
                  Complete standalone file — copy and paste into any .html file
                </span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(htmlSource).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  });
                }}
                style={{
                  background: copied ? "#16a34a" : primaryColor,
                  color: "#fff",
                  border: "none",
                  borderRadius: 7,
                  padding: "8px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background .2s",
                  whiteSpace: "nowrap",
                }}
              >
                {copied ? "✓ Copied!" : "Copy HTML"}
              </button>
            </div>
            {/* Code block */}
            <pre style={{
              margin: 0,
              padding: "20px",
              overflowX: "auto",
              maxHeight: 400,
              fontSize: 11.5,
              lineHeight: 1.6,
              color: "#a8b4d0",
              fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
              whiteSpace: "pre",
            }}>
              <code>{htmlSource}</code>
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
