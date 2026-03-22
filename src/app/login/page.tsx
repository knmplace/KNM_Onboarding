"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-md theme-card p-6">
        <div className="flex justify-center mb-5">
          <Image src="/logo.jpg" alt="Homestead" width={120} height={120} priority />
        </div>
        <h1 className="text-xl font-semibold mb-1 text-center">Homestead</h1>
        <p className="text-sm theme-text-muted mb-5 text-center">Sign in with your admin account.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm theme-text-muted mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="theme-input px-3 py-2 text-sm"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="block text-sm theme-text-muted mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="theme-input px-3 py-2 text-sm"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className="theme-alert theme-alert--error">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="theme-button theme-button--primary w-full px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
