"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { FunnelStats } from "@/components/funnel-stats";
import { UsersTable, OnboardingUser } from "@/components/users-table";
import { UserDetailPanel } from "@/components/user-detail-panel";
import { GuideGeneratorModal } from "@/components/guide-generator-modal";
import { ThemeToggle } from "@/components/theme-toggle";
import { GettingStarted } from "@/components/getting-started";
import { VersionUpdateBanner } from "@/components/version-update-banner";
import { useUpdate, UpdateOverlay } from "@/components/update-overlay";
import { APP_VERSION } from "@/lib/version";

type StepFilter = "all" | "pending_approval" | "awaiting_password_change" | "completed";
type BreachFilter = "all" | "true" | "false";
type SearchScope = "current" | "all";
type SiteOption = {
  id: number;
  slug: string;
  name: string;
  userCount: number;
  isActive: boolean;
};

export default function Dashboard() {
  const [users, setUsers] = useState<OnboardingUser[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [runningBreachScan, setRunningBreachScan] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OnboardingUser | null>(null);
  const [stepFilter, setStepFilter] = useState<StepFilter>("all");
  const [breachFilter, setBreachFilter] = useState<BreachFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("current");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedForBreachScan, setSelectedForBreachScan] = useState<number[]>([]);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [checklistDismissed, setChecklistDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem(`homestead_checklist_dismissed_${APP_VERSION}`);
  });
  const { overlay: updateOverlay, status: updateStatus, countdown, triggerUpdate } = useUpdate();

  const fetchSites = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/sites");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch sites");

      const nextSites = Array.isArray(data.sites) ? data.sites : [];
      setSites(nextSites);
      setSelectedSiteId((current) => {
        if (current && nextSites.some((site: SiteOption) => site.id === current)) {
          return current;
        }
        const defaultSite = nextSites[0];
        return defaultSite?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch sites");
    } finally {
      setSitesLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    if (!selectedSiteId) {
      setUsers([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const params = new URLSearchParams();
      params.set("siteId", String(selectedSiteId));
      if (stepFilter !== "all") params.set("step", stepFilter);
      if (breachFilter !== "all") params.set("breached", breachFilter);
      const normalizedSearch = searchTerm.trim();
      if (normalizedSearch) {
        params.set("search", normalizedSearch);
        params.set("searchScope", searchScope);
      }

      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.users);
      setSelectedForBreachScan((prev) =>
        prev.filter((id) => data.users.some((u: OnboardingUser) => u.id === id))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [breachFilter, searchScope, searchTerm, selectedSiteId, stepFilter]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  useEffect(() => {
    if (!sitesLoading) {
      setLoading(true);
    }
    fetchUsers();
  }, [fetchUsers, sitesLoading]);

  useEffect(() => {
    setSelectedUser(null);
    setSelectedForBreachScan([]);
  }, [selectedSiteId]);

  const selectedSite = sites.find((site) => site.id === selectedSiteId) ?? null;

  const handleSync = async () => {
    if (!selectedSiteId) return;

    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: selectedSiteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotice(`Sync complete for ${selectedSite?.name || "selected site"}.`);
      await fetchUsers();
      await fetchSites();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleFullSync = async () => {
    if (!selectedSiteId) return;

    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/onboarding/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: selectedSiteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotice(`Full sync complete for ${selectedSite?.name || "selected site"}.`);
      await fetchUsers();
      await fetchSites();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Full sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleAction = async (userId: number, action: string) => {
    try {
      setError(null);
      setNotice(null);
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchUsers();
      setSelectedUser(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  };

  const handleOverride = async (userId: number, step: string) => {
    try {
      setError(null);
      setNotice(null);
      const res = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, step }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchUsers();
      setSelectedUser(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Override failed");
    }
  };

  const handleValidateEmail = async (userId: number) => {
    try {
      setError(null);
      setNotice(null);
      const res = await fetch("/api/validate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchUsers();
      setSelectedUser(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Email validation failed");
    }
  };

  const handleRunReminderTest = async (userId: number) => {
    try {
      setError(null);
      setNotice(null);
      const res = await fetch("/api/onboarding/reminders/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          siteId: selectedSiteId,
          dryRun: false,
          forceSend: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reminder test failed");

      const actionSummary =
        Array.isArray(data.actions) && data.actions.length > 0
          ? data.actions.map((a: { action: string }) => a.action).join(", ")
          : "no actions";
      setNotice(`Reminder test email sent: ${actionSummary}`);
      await fetchUsers();
      setSelectedUser(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reminder test failed");
    }
  };

  const handleRunBreachScan = async () => {
    if (!selectedSiteId) return;

    const targetUserIds =
      selectedForBreachScan.length > 0 ? selectedForBreachScan : users.map((user) => user.id);
    const selectedCount = targetUserIds.length;
    if (selectedCount === 0) {
      setNotice(`No users are currently listed for ${selectedSite?.name || "this site"}.`);
      return;
    }

    const confirmationMessage =
      selectedForBreachScan.length > 0
        ? `Run breach recheck for ${selectedCount} selected user${selectedCount > 1 ? "s" : ""}? Only selected users will be processed.`
        : `No users selected. Run breach recheck for all ${selectedCount} users currently listed for ${selectedSite?.name || "this site"}?`;
    if (!confirm(confirmationMessage)) return;

    setRunningBreachScan(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/onboarding/breach-scan/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun: false,
          forceNotify: false,
          siteId: selectedSiteId,
          userIds: targetUserIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Breach scan failed");

      setNotice(
        `Breach scan complete: scanned ${data.scanned}, validated ${data.validated}, breached ${data.breached}, notified ${data.notified}, cooldown-skipped ${data.skippedCooldown}.`
      );
      await fetchUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Breach scan failed");
    } finally {
      setRunningBreachScan(false);
    }
  };

  const handleToggleSelectUser = (userId: number, checked: boolean) => {
    setSelectedForBreachScan((prev) => {
      if (checked) {
        if (prev.includes(userId)) return prev;
        return [...prev, userId];
      }
      return prev.filter((id) => id !== userId);
    });
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedForBreachScan(users.map((u) => u.id));
      return;
    }
    setSelectedForBreachScan([]);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  };

  const counts = {
    total: users.length,
    pending_approval: users.filter((u) => u.onboardingStep === "pending_approval").length,
    awaiting_password_change: users.filter((u) => u.onboardingStep === "awaiting_password_change").length,
    completed: users.filter((u) => u.onboardingStep === "completed").length,
  };

  return (
    <>
    <UpdateOverlay overlay={updateOverlay} status={updateStatus} countdown={countdown} />
    <main className="page-shell">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Image src="/logo.jpg" alt="Homestead" width={36} height={36} className="rounded-lg" />
            <h1 className="text-2xl font-bold">
              Homestead
              <span className="text-xs font-normal theme-text-soft align-middle ml-2">
                v{APP_VERSION}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm theme-text-muted mt-1 flex-wrap">
            <label htmlFor="site-select">Selected site:</label>
            <select
              id="site-select"
              value={selectedSiteId ?? ""}
              onChange={(e) => setSelectedSiteId(Number.parseInt(e.target.value, 10))}
              disabled={sitesLoading || sites.length === 0}
              className="theme-select text-sm px-2 py-1"
            >
              {sites.length === 0 ? (
                <option value="">No sites configured</option>
              ) : (
                sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))
              )}
            </select>
            {selectedSite && (
              <span>
                <strong>{selectedSite.slug}</strong> - {selectedSite.userCount} linked users
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 items-center flex-wrap justify-end">
          <button
            onClick={handleLogout}
            className="theme-button theme-button--ghost px-3 py-1.5 text-sm"
          >
            Logout
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="theme-button theme-button--ghost px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync Users"}
          </button>
          <button
            onClick={handleFullSync}
            disabled={syncing}
            className="theme-button theme-button--primary px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Full Sync"}
          </button>
          <button
            onClick={() => setShowGuideModal(true)}
            className="theme-button theme-button--indigo px-3 py-1.5 text-sm"
          >
            Generate Guide
          </button>
          <button
            onClick={handleRunBreachScan}
            disabled={runningBreachScan}
            className="theme-button theme-button--warning px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {runningBreachScan
              ? "Running..."
              : selectedForBreachScan.length > 0
                ? `Run Breach Recheck (${selectedForBreachScan.length})`
                : "Run Breach Recheck"}
          </button>
          <Link
            href={selectedSiteId ? `/deleted?siteId=${selectedSiteId}` : "/deleted"}
            className="theme-button theme-button--ghost px-3 py-1.5 text-sm text-red-600"
          >
            Deleted Users
          </Link>
          <Link
            href="/sites"
            className="theme-button theme-button--ghost px-3 py-1.5 text-sm"
          >
            Sites
          </Link>
          <Link
            href="/settings"
            className="theme-button theme-button--ghost px-3 py-1.5 text-sm"
          >
            Settings
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {error && <div className="theme-alert theme-alert--error">{error}</div>}
      {notice && <div className="theme-alert theme-alert--success">{notice}</div>}

      <VersionUpdateBanner onUpdateClick={triggerUpdate} />

      {!checklistDismissed && (
        <GettingStarted
          onDismiss={() => setChecklistDismissed(true)}
          onSyncClick={handleFullSync}
        />
      )}

      <FunnelStats counts={counts} />

      <div className="flex gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm theme-text-muted">Step:</label>
          <select
            value={stepFilter}
            onChange={(e) => setStepFilter(e.target.value as StepFilter)}
            className="theme-select text-sm px-2 py-1"
          >
            <option value="all">All</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="awaiting_password_change">Awaiting Password</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm theme-text-muted">Breached:</label>
          <select
            value={breachFilter}
            onChange={(e) => setBreachFilter(e.target.value as BreachFilter)}
            className="theme-select text-sm px-2 py-1"
          >
            <option value="all">All</option>
            <option value="true">Breached</option>
            <option value="false">Clean</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm theme-text-muted">Search:</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Name, email, or WP ID"
            className="theme-input text-sm px-2 py-1 w-56"
          />
          <select
            value={searchScope}
            onChange={(e) => setSearchScope(e.target.value as SearchScope)}
            disabled={searchTerm.trim().length === 0}
            className="theme-select text-sm px-2 py-1 min-w-36"
          >
            <option value="current">Current Site</option>
            <option value="all">All Sites</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3 text-sm theme-text-muted">
        <span>
          Selected for breach recheck: <strong>{selectedForBreachScan.length}</strong>
        </span>
        {selectedForBreachScan.length > 0 && (
          <button
            onClick={() => setSelectedForBreachScan([])}
            className="theme-link hover:underline"
          >
            Clear selection
          </button>
        )}
      </div>

      <div className="theme-card">
        {sitesLoading ? (
          <div className="theme-empty">Loading sites...</div>
        ) : !selectedSite ? (
          <div className="theme-empty">No active site selected. Add a site to get started.</div>
        ) : loading ? (
          <div className="theme-empty">Loading...</div>
        ) : (
          <UsersTable
            users={users}
            onSelectUser={setSelectedUser}
            showSiteColumn={searchScope === "all" && searchTerm.trim().length > 0}
            selectedUserIds={selectedForBreachScan}
            onToggleSelectUser={handleToggleSelectUser}
            onToggleSelectAll={handleToggleSelectAll}
          />
        )}
      </div>

      {selectedUser && (
        <UserDetailPanel
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onAction={handleAction}
          onOverride={handleOverride}
          onValidateEmail={handleValidateEmail}
          onRunReminderTest={handleRunReminderTest}
        />
      )}

      {showGuideModal && (
        <GuideGeneratorModal onClose={() => setShowGuideModal(false)} />
      )}
    </main>
    </>
  );
}
