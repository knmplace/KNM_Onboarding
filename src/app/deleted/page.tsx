"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { OnboardingUser } from "@/components/users-table";
import { ThemeToggle } from "@/components/theme-toggle";

type SiteOption = {
  id: number;
  slug: string;
  name: string;
  userCount: number;
  isActive: boolean;
};

export default function DeletedUsersPage() {
  const [users, setUsers] = useState<OnboardingUser[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSites = async () => {
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
  };

  const fetchDeleted = async () => {
    if (!selectedSiteId) {
      setUsers([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const res = await fetch(`/api/users/deleted?siteId=${selectedSiteId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch deleted users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const siteIdParam = params.get("siteId");
    if (siteIdParam) {
      const parsed = Number.parseInt(siteIdParam, 10);
      if (!Number.isNaN(parsed)) {
        setSelectedSiteId(parsed);
      }
    }
    fetchSites();
  }, []);

  useEffect(() => {
    setSelected(new Set());
    setLoading(true);
    fetchDeleted();
  }, [selectedSiteId]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === users.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(users.map((u) => u.id)));
    }
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Permanently delete ${selected.size} user(s)? This cannot be undone.`)) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/users/deleted", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), siteId: selectedSiteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelected(new Set());
      await fetchDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const selectedSite = sites.find((site) => site.id === selectedSiteId) ?? null;

  return (
    <main className="page-shell">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/" className="text-sm theme-link hover:underline">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Deleted Users</h1>
          <span className="text-sm theme-text-muted">
            Users removed from WordPress/ProfileGrid
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="theme-button theme-button--danger px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {deleting ? "Deleting..." : `Delete Selected (${selected.size})`}
            </button>
          )}
          <ThemeToggle />
        </div>
      </div>

      {error && <div className="theme-alert theme-alert--error">{error}</div>}

      <div className="mb-4 flex items-center gap-3 text-sm theme-text-muted flex-wrap">
        <label htmlFor="deleted-site-select">Selected site:</label>
        <select
          id="deleted-site-select"
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
            <strong>{selectedSite.slug}</strong> archived users
          </span>
        )}
      </div>

      <div className="theme-card">
        {sitesLoading ? (
          <div className="theme-empty">Loading sites...</div>
        ) : !selectedSite ? (
          <div className="theme-empty">No active site selected.</div>
        ) : loading ? (
          <div className="theme-empty">Loading...</div>
        ) : users.length === 0 ? (
          <div className="theme-empty">No deleted users found for {selectedSite.name}.</div>
        ) : (
          <div className="theme-table-wrap">
            <table className="theme-table">
              <thead>
                <tr>
                  <th className="py-2 px-3 font-medium">
                    <input
                      type="checkbox"
                      checked={selected.size === users.length && users.length > 0}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="py-2 px-3 font-medium">Name</th>
                  <th className="py-2 px-3 font-medium">Email</th>
                  <th className="py-2 px-3 font-medium">WP ID</th>
                  <th className="py-2 px-3 font-medium">Last Step</th>
                  <th className="py-2 px-3 font-medium">Deleted At</th>
                  <th className="py-2 px-3 font-medium">Originally Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={selected.has(user.id) ? "bg-red-50/70" : ""}
                  >
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={selected.has(user.id)}
                        onChange={() => toggleSelect(user.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="py-2 px-3">
                      {user.displayName ||
                        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                        "—"}
                    </td>
                    <td className="py-2 px-3 theme-text-muted">{user.email}</td>
                    <td className="py-2 px-3 theme-text-soft">{user.wordpressId}</td>
                    <td className="py-2 px-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        {user.onboardingStep.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-2 px-3 theme-text-soft text-xs">
                      {user.deletedAt
                        ? new Date(user.deletedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="py-2 px-3 theme-text-soft text-xs">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
