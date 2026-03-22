"use client";

import { useEffect, useState } from "react";
import type { UpdateType, VersionCheckResult } from "@/app/api/version-check/route";

type Props = {
  onUpdateClick: () => void;
};

const DISMISSED_STORAGE_KEY = "homestead_update_banner_dismissed";

const UPDATE_STYLES: Record<
  NonNullable<UpdateType>,
  { label: string; labelClass: string; borderColor: string; bgColor: string }
> = {
  patch: {
    label: "Patch update",
    labelClass: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
    borderColor: "var(--accent, #3b82f6)",
    bgColor: "rgba(59,130,246,0.06)",
  },
  minor: {
    label: "Minor update",
    labelClass: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
    borderColor: "#eab308",
    bgColor: "rgba(234,179,8,0.06)",
  },
  major: {
    label: "Major update",
    labelClass: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
    borderColor: "#f97316",
    bgColor: "rgba(249,115,22,0.06)",
  },
};

export function VersionUpdateBanner({ onUpdateClick }: Props) {
  const [info, setInfo] = useState<VersionCheckResult | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    fetch("/api/version-check")
      .then((r) => r.json())
      .then((data: VersionCheckResult) => {
        if (!data.updateType) return; // No update available
        // Check if user already dismissed this specific version
        const key = `${DISMISSED_STORAGE_KEY}_${data.latest}`;
        if (localStorage.getItem(key)) return;
        setInfo(data);
      })
      .catch(() => {});
  }, []);

  if (!info || !info.updateType || dismissed) return null;

  const style = UPDATE_STYLES[info.updateType];

  function handleDismiss() {
    if (info?.latest) {
      localStorage.setItem(`${DISMISSED_STORAGE_KEY}_${info.latest}`, "1");
    }
    setDismissed(true);
  }

  return (
    <div
      className="theme-card mb-6 overflow-hidden"
      style={{ borderColor: style.borderColor, background: style.bgColor }}
    >
      <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-0.5 text-lg select-none">↑</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-sm">
                Homestead {info.latest} available
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.labelClass}`}>
                {style.label}
              </span>
            </div>
            <p className="text-xs theme-text-muted">
              You are running v{info.current}.{" "}
              {info.updateType === "major"
                ? "This is a major release — review the release notes before updating."
                : info.updateType === "minor"
                ? "This release includes new features and improvements."
                : "This release includes bug fixes and minor improvements."}
            </p>
            {info.releaseNotes && (
              <button
                onClick={() => setShowNotes((s) => !s)}
                className="text-xs theme-text-muted underline mt-1"
              >
                {showNotes ? "Hide release notes" : "View release notes"}
              </button>
            )}
            {showNotes && info.releaseNotes && (
              <pre className="mt-2 text-xs theme-text-muted whitespace-pre-wrap bg-black/20 rounded p-3 max-h-40 overflow-y-auto">
                {info.releaseNotes}
              </pre>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onUpdateClick}
            className="theme-button theme-button--primary px-3 py-1.5 text-xs"
          >
            Update Now
          </button>
          <button
            onClick={handleDismiss}
            className="theme-button theme-button--ghost px-3 py-1.5 text-xs"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
