"use client";

import { FormEvent, useState } from "react";
import type { BrandGuideResult } from "@/app/api/tools/brand-guide/route";

type Props = {
  onClose: () => void;
};

type FetchState = "idle" | "fetching" | "done" | "error";
type Brightness = "light" | "dark" | "unknown";

function proxied(url: string | null | undefined): string | null {
  if (!url) return null;
  return `/api/tools/proxy-image?url=${encodeURIComponent(url)}`;
}

/**
 * Draw image to an offscreen canvas, sample a grid of pixels, compute
 * average relative luminance (0–1). Returns "light", "dark", or "unknown".
 * Ignores fully-transparent pixels so logos with transparent backgrounds
 * are judged on their actual ink, not the empty canvas.
 */
function sampleImageBrightness(src: string): Promise<Brightness> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const SIZE = 64; // downsample to 64×64 for speed
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve("unknown");
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
        let total = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 32) continue; // skip transparent/near-transparent pixels
          // sRGB relative luminance approximation
          const r = data[i] / 255;
          const g = data[i + 1] / 255;
          const b = data[i + 2] / 255;
          total += 0.299 * r + 0.587 * g + 0.114 * b;
          count++;
        }
        if (count === 0) return resolve("unknown");
        resolve(total / count > 0.5 ? "light" : "dark");
      } catch {
        resolve("unknown");
      }
    };
    img.onerror = () => resolve("unknown");
    img.src = src;
  });
}

/** Returns a background color that contrasts well against the image brightness */
function contrastBg(brightness: Brightness, fallback = "#ffffff"): string {
  // "light" means the logo itself is light/white — it has its own background, show on white
  // "dark"  means the logo pixels are dark — needs a light container to be visible
  if (brightness === "light") return "#ffffff";
  if (brightness === "dark")  return "#f3f4f6";
  return fallback;
}

function darkenHex(hex: string, amount = 20): string {
  const h = hex.replace("#", "");
  const num = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function GuideGeneratorModal({ onClose }: Props) {
  const [siteUrl, setSiteUrl] = useState("");
  const [siteName, setSiteName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [branding, setBranding] = useState<BrandGuideResult | null>(null);
  const [logoBrightness, setLogoBrightness] = useState<Brightness>("unknown");
  const [iconBrightness, setIconBrightness] = useState<Brightness>("unknown");
  // allow user to override detected color
  const [colorOverride, setColorOverride] = useState<string>("");

  const effectiveColor = colorOverride || branding?.primaryColor || "#1a3a6e";

  async function handleFetchBranding(e: FormEvent) {
    e.preventDefault();
    if (!siteUrl.trim()) return;
    setFetchState("fetching");
    setFetchError(null);
    setBranding(null);

    try {
      const res = await fetch("/api/tools/brand-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl: siteUrl.trim(), siteName: siteName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch branding");

      const b: BrandGuideResult = data.branding;
      setBranding(b);
      // Pre-fill overrideable fields from detected values
      if (!siteName.trim()) setSiteName(b.siteName);
      if (!supportEmail.trim() && b.supportEmail) setSupportEmail(b.supportEmail);
      if (!loginUrl.trim() && b.loginUrl) setLoginUrl(b.loginUrl);
      setColorOverride(b.primaryColor);
      setFetchState("done");
      // Sample logo/icon brightness for contrast-aware backgrounds
      setLogoBrightness("unknown");
      setIconBrightness("unknown");
      if (b.logoUrl) sampleImageBrightness(proxied(b.logoUrl)!).then(setLogoBrightness);
      if (b.iconUrl)  sampleImageBrightness(proxied(b.iconUrl)!).then(setIconBrightness);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to fetch branding");
      setFetchState("error");
    }
  }

  function handleGenerate() {
    const params = new URLSearchParams({
      name: siteName || branding?.siteName || "Your Site",
      color: effectiveColor,
      email: supportEmail || branding?.supportEmail || "support@yoursite.com",
      login: loginUrl || branding?.loginUrl || `${siteUrl}/login`,
      url: siteUrl,
    });
    if (branding?.logoUrl) params.set("logo", branding.logoUrl);
    if (branding?.iconUrl) params.set("icon", branding.iconUrl);
    if (logoBrightness !== "unknown") params.set("logoBrightness", logoBrightness);
    if (iconBrightness  !== "unknown") params.set("iconBrightness", iconBrightness);

    window.open(`/guide-preview?${params.toString()}`, "_blank");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Generate Onboarding Guide</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Enter a site URL to auto-detect branding, then generate a branded PDF guide.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Step 1 — URL + fetch */}
          <form onSubmit={handleFetchBranding} className="space-y-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Step 1 — Detect Site Branding
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                required
              />
              <button
                type="submit"
                disabled={fetchState === "fetching"}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
              >
                {fetchState === "fetching" ? "Fetching…" : "Fetch Branding"}
              </button>
            </div>
            {fetchError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {fetchError}
              </p>
            )}
          </form>

          {/* Branding preview */}
          {branding && (
            <div
              className="rounded-lg border p-4 space-y-3"
              style={{ borderColor: effectiveColor + "44", background: effectiveColor + "0d" }}
            >
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Detected Branding
              </div>
              <div className="flex items-center gap-3">
                {branding.iconUrl || branding.logoUrl ? (
                  <img
                    src={proxied(branding.iconUrl ?? branding.logoUrl) ?? ""}
                    alt="Site logo"
                    className="w-10 h-10 rounded object-contain bg-white border border-gray-200 p-0.5"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center text-white font-bold text-lg"
                    style={{ background: effectiveColor }}
                  >
                    {(siteName || branding.siteName).charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-sm text-gray-900">{branding.siteName}</div>
                  <div className="text-xs text-gray-500">{branding.rawUrl}</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full border border-gray-300 shadow-sm"
                    style={{ background: effectiveColor }}
                    title={`Detected color: ${effectiveColor}`}
                  />
                  <input
                    type="color"
                    value={effectiveColor}
                    onChange={(e) => setColorOverride(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                    title="Override brand color"
                  />
                </div>
              </div>
              {/* Logo assets found */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded border border-gray-200 p-2" style={{ background: contrastBg(logoBrightness, "#fff") }}>
                  <div className="text-xs text-gray-400 mb-1.5 font-medium" style={{ color: logoBrightness === "dark" ? "#374151" : "#9ca3af" }}>Site Logo {logoBrightness !== "unknown" && <span className="opacity-60">({logoBrightness})</span>}</div>
                  {branding.logoUrl ? (
                    <img
                      src={proxied(branding.logoUrl) ?? ""}
                      alt="Logo"
                      className="h-10 max-w-full object-contain"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = "none";
                        el.parentElement!.insertAdjacentHTML("beforeend", `<span class="text-xs text-gray-400 italic">Failed to load</span>`);
                      }}
                    />
                  ) : (
                    <span className="text-xs text-gray-400 italic">Not found</span>
                  )}
                </div>
                <div className="rounded border border-gray-200 p-2" style={{ background: contrastBg(iconBrightness, "#fff") }}>
                  <div className="text-xs text-gray-400 mb-1.5 font-medium" style={{ color: iconBrightness === "dark" ? "#374151" : "#9ca3af" }}>Favicon / Icon {iconBrightness !== "unknown" && <span className="opacity-60">({iconBrightness})</span>}</div>
                  {branding.iconUrl ? (
                    <img
                      src={proxied(branding.iconUrl) ?? ""}
                      alt="Icon"
                      className="h-10 max-w-full object-contain"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = "none";
                        el.parentElement!.insertAdjacentHTML("beforeend", `<span class="text-xs text-gray-400 italic">Failed to load</span>`);
                      }}
                    />
                  ) : (
                    <span className="text-xs text-gray-400 italic">Not found</span>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Color:{" "}
                <code className="bg-white border border-gray-200 rounded px-1">{effectiveColor}</code>
                {" "}— click the color picker to override
              </div>
            </div>
          )}

          {/* Step 2 — Customize */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Step 2 — Confirm Details
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <div className="text-gray-600 mb-1 text-xs">Site Name</div>
                <input
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="My Site"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <div className="text-gray-600 mb-1 text-xs">Support Email</div>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="support@example.com"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="text-sm">
              <div className="text-gray-600 mb-1 text-xs">Login URL</div>
              <input
                type="url"
                value={loginUrl}
                onChange={(e) => setLoginUrl(e.target.value)}
                placeholder="https://example.com/login"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </label>
          </div>

          {/* Preview swatch */}
          {(branding || siteName) && (
            <div className="rounded-lg overflow-hidden border border-gray-200 text-xs">
              {/* mini email brand bar preview */}
              <div
                className="px-3 py-2 flex items-center gap-2"
                style={{ background: "#1e1e2e" }}
              >
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0"
                  style={{
                    background: logoBrightness === "light" ? "#ffffff" : logoBrightness === "dark" ? "#f3f4f6" : effectiveColor,
                    border: logoBrightness === "light" ? "1px solid #e5e7eb" : "none",
                  }}
                >
                  {branding?.iconUrl || branding?.logoUrl ? (
                    <img
                      src={proxied(branding.iconUrl ?? branding.logoUrl) ?? ""}
                      alt=""
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.style.display = "none";
                        img.parentElement!.textContent = (siteName || branding?.siteName || "Y").charAt(0).toUpperCase();
                      }}
                    />
                  ) : (
                    (siteName || branding?.siteName || "Y").charAt(0).toUpperCase()
                  )}
                </div>
                <span className="text-gray-400 font-semibold uppercase tracking-wide">
                  {siteName || branding?.siteName || "Your Site"} — Secure Onboarding
                </span>
              </div>
              <div
                className="px-3 py-3 text-white"
                style={{ background: effectiveColor }}
              >
                <div className="font-bold text-sm">Welcome — Your Account is Active!</div>
                <div style={{ color: "rgba(255,255,255,0.75)" }}>One last step: log in and set your password</div>
              </div>
              <div className="px-3 py-2 bg-white text-gray-500">
                Hello <strong>Jane Smith</strong>, your account has been approved…
                <span
                  className="ml-2 px-2 py-0.5 rounded text-white text-xs font-semibold"
                  style={{ background: effectiveColor }}
                >
                  Log In →
                </span>
              </div>
            </div>
          )}

          {/* Generate button */}
          <div className="pt-1">
            <button
              onClick={handleGenerate}
              disabled={!siteName && !branding}
              className="w-full py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-40 transition-all"
              style={{
                background:
                  !siteName && !branding
                    ? "#9ca3af"
                    : `linear-gradient(135deg, ${effectiveColor}, ${darkenHex(effectiveColor, 30)})`,
              }}
            >
              Generate Branded Guide →
            </button>
            <p className="text-xs text-gray-400 text-center mt-2">
              Opens in a new tab — use your browser's Print → Save as PDF
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
