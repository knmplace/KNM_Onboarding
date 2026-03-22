"use client";

import Image from "next/image";
import { useRef, useState } from "react";

export type UpdateState = {
  overlay: boolean;
  status: "updating" | "back-online";
  countdown: number;
  error: string | null;
};

export function useUpdate() {
  const [overlay, setOverlay] = useState(false);
  const [status, setStatus] = useState<"updating" | "back-online">("updating");
  const [countdown, setCountdown] = useState(150);
  const [error, setError] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function triggerUpdate() {
    if (
      !confirm(
        "Start an update now?\n\nThis will:\n• Pull the latest code from GitHub\n• Run database migrations\n• Rebuild the app\n• Restart the server automatically\n\nThe app will be unavailable for 2–5 minutes during the update. Continue?"
      )
    )
      return;

    setError(null);
    try {
      const res = await fetch("/api/admin/update", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start update.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start update.");
      return;
    }

    setStatus("updating");
    setCountdown(150);
    setOverlay(true);

    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);

    setTimeout(() => {
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch("/api/health", { cache: "no-store" });
          if (r.ok) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            if (pollRef.current) clearInterval(pollRef.current);
            setStatus("back-online");
            setTimeout(() => window.location.reload(), 2000);
          }
        } catch {
          // Still down — keep polling
        }
      }, 5000);
    }, 45000);
  }

  return { overlay, status, countdown, error, triggerUpdate };
}

type Props = {
  overlay: boolean;
  status: "updating" | "back-online";
  countdown: number;
};

export function UpdateOverlay({ overlay, status, countdown }: Props) {
  if (!overlay) return null;

  const countdownMins = Math.floor(countdown / 60);
  const countdownSecs = countdown % 60;
  const countdownStr = `${countdownMins}:${String(countdownSecs).padStart(2, "0")}`;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(12px)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: "24px",
      }}
    >
      {status === "back-online" ? (
        <>
          <div style={{ fontSize: "56px" }}>✅</div>
          <div style={{ color: "#f5f5f7", fontSize: "22px", fontWeight: 700 }}>Back online!</div>
          <div style={{ color: "#a1a1a6", fontSize: "14px" }}>Reloading the page...</div>
        </>
      ) : (
        <>
          <div style={{ position: "relative", width: 80, height: 80 }}>
            <div style={{
              position: "absolute", inset: -8,
              borderRadius: "50%",
              border: "2px solid rgba(99,179,237,0.4)",
              animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
            }} />
            <Image src="/logo.jpg" alt="Homestead" width={80} height={80} style={{ borderRadius: 16, position: "relative", zIndex: 1 }} />
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#f5f5f7", fontSize: "22px", fontWeight: 700, marginBottom: 6 }}>
              Updating Homestead...
            </div>
            <div style={{ color: "#a1a1a6", fontSize: "14px" }}>
              Pulling latest code, rebuilding, and restarting
            </div>
          </div>

          <div style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "14px 32px",
            textAlign: "center",
          }}>
            <div style={{ color: "#a1a1a6", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              {countdown > 0 ? "Estimated time remaining" : "Taking a bit longer than expected..."}
            </div>
            <div style={{ color: "#63b3ed", fontSize: "36px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {countdown > 0 ? countdownStr : "Still checking..."}
            </div>
          </div>

          <div style={{ width: 280, height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              background: "linear-gradient(90deg, #63b3ed, #a78bfa)",
              borderRadius: 2,
              animation: "shimmer 1.8s ease-in-out infinite",
              width: "60%",
            }} />
          </div>

          <div style={{ color: "#6b6b6b", fontSize: "12px" }}>
            The page will reload automatically when the update is complete.
          </div>
        </>
      )}

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(280px); }
        }
      `}</style>
    </div>
  );
}
