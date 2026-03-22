"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  link: string | null;
  description: string;
  optional?: boolean;
  manualDismiss?: boolean;
  action?: string;
};

type Props = {
  onDismiss: () => void;
  onSyncClick: () => void;
};

const DISMISSED_KEY = "adob_checklist_dismissed_v1";
const MUPLUGIN_KEY = "adob_muplugin_dismissed_v1";

export function GettingStarted({ onDismiss, onSyncClick }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [allDone, setAllDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [muPluginDone, setMuPluginDone] = useState(false);

  useEffect(() => {
    setMuPluginDone(!!localStorage.getItem(MUPLUGIN_KEY));
    fetch("/api/checklist")
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
        setAllDone(data.allDone ?? false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleMuPluginDismiss() {
    localStorage.setItem(MUPLUGIN_KEY, "1");
    setMuPluginDone(true);
  }

  function handleDismissAll() {
    localStorage.setItem(DISMISSED_KEY, "1");
    onDismiss();
  }

  if (loading) return null;

  const resolvedItems = items.map((item) =>
    item.id === "muplugin" ? { ...item, done: muPluginDone } : item
  );

  const pendingRequired = resolvedItems.filter((i) => !i.optional && !i.done);
  const pendingOptional = resolvedItems.filter((i) => i.optional && !i.done);
  const doneItems = resolvedItems.filter((i) => i.done);

  return (
    <div className="theme-card mb-6 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
        <div>
          <h2 className="font-semibold text-base">Getting Started</h2>
          <p className="text-xs theme-text-muted mt-0.5">
            {pendingRequired.length === 0
              ? "All required steps complete — you're good to go!"
              : `${pendingRequired.length} step${pendingRequired.length !== 1 ? "s" : ""} remaining to complete setup`}
          </p>
        </div>
        <button
          onClick={handleDismissAll}
          className="theme-button theme-button--ghost px-3 py-1 text-xs"
          title="Dismiss this checklist"
        >
          Dismiss
        </button>
      </div>

      {/* Items */}
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {resolvedItems.map((item) => (
          <div key={item.id} className="px-5 py-3 flex items-start gap-3">
            {/* Checkbox */}
            <div className="mt-0.5 shrink-0">
              {item.done ? (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: "var(--success-text, #16a34a)" }}
                >
                  ✓
                </div>
              ) : item.optional ? (
                <div
                  className="w-5 h-5 rounded-full border-2"
                  style={{ borderColor: "var(--border-strong, #6b7280)" }}
                />
              ) : (
                <div
                  className="w-5 h-5 rounded-full border-2"
                  style={{ borderColor: "var(--accent)" }}
                />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-medium ${item.done ? "line-through theme-text-muted" : ""}`}>
                  {item.label}
                </span>
                {item.optional && (
                  <span className="text-xs theme-text-soft px-1.5 py-0.5 rounded" style={{ background: "var(--panel)" }}>
                    optional
                  </span>
                )}
              </div>
              {!item.done && (
                <p className="text-xs theme-text-muted mt-0.5">{item.description}</p>
              )}
            </div>

            {/* Action */}
            {!item.done && (
              <div className="shrink-0">
                {item.action === "sync" ? (
                  <button
                    onClick={onSyncClick}
                    className="theme-button theme-button--primary px-3 py-1 text-xs"
                  >
                    Run Sync
                  </button>
                ) : item.manualDismiss ? (
                  <div className="flex gap-2">
                    {item.link && (
                      <Link href={item.link} className="theme-button theme-button--primary px-3 py-1 text-xs">
                        View Guide
                      </Link>
                    )}
                    <button
                      onClick={handleMuPluginDismiss}
                      className="theme-button theme-button--ghost px-3 py-1 text-xs"
                    >
                      Mark Done
                    </button>
                  </div>
                ) : item.link ? (
                  <Link href={item.link} className="theme-button theme-button--primary px-3 py-1 text-xs">
                    Configure
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer when all done */}
      {pendingRequired.length === 0 && pendingOptional.length === 0 && (
        <div className="px-5 py-3 text-center">
          <p className="text-sm theme-text-muted mb-2">All steps complete. You can dismiss this checklist.</p>
          <button onClick={handleDismissAll} className="theme-button theme-button--primary px-4 py-1.5 text-sm">
            Got it, dismiss
          </button>
        </div>
      )}
    </div>
  );
}
