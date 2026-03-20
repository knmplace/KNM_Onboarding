"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { OnboardingUser } from "@/components/users-table";

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
        const defaultSite =
          nextSites[0]; // First site is the default
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
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Deleted Users</h1>
          <span className="text-sm text-gray-500">
            Users removed from WordPress/ProfileGrid
          </span>
        </div>
        {selected.size > 0 && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
          >
            {deleting
              ? "Deleting..."
              : `Delete Selected (${selected.size})`}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      <div className="mb-4 flex items-center gap-3 text-sm text-gray-600">
        <label htmlFor="deleted-site-select">Selected site:</label>
        <select
          id="deleted-site-select"
          value={selectedSiteId ?? ""}
          onChange={(e) => setSelectedSiteId(Number.parseInt(e.target.value, 10))}
          disabled={sitesLoading || sites.length === 0}
          className="text-sm border border-gray-300 rounded px-2 py-1 bg-white text-gray-700"
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

      <div className="bg-white rounded-lg border border-gray-200">
        {sitesLoading ? (
          <div className="text-center py-12 text-gray-400">Loading sites...</div>
        ) : !selectedSite ? (
          <div className="text-center py-12 text-gray-400">
            No active site selected.
          </div>
        ) : loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No deleted users found for {selectedSite.name}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
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
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      selected.has(user.id) ? "bg-red-50" : ""
                    }`}
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
                    <td className="py-2 px-3 text-gray-600">{user.email}</td>
                    <td className="py-2 px-3 text-gray-400">{user.wordpressId}</td>
                    <td className="py-2 px-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        {user.onboardingStep.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-400 text-xs">
                      {user.deletedAt
                        ? new Date(user.deletedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="py-2 px-3 text-gray-400 text-xs">
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
