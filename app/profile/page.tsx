"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/hooks/useSession";

export default function ProfilePage() {
  const { user } = useSession();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [ssuAddress, setSsuAddress] = useState("");
  const [ssuLoading, setSsuLoading] = useState(false);
  const [ssuSuccess, setSsuSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/auth/ssu")
      .then((r) => r.json())
      .then((d) => setSsuAddress(d.ssuAddress ?? ""));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (next !== confirm) {
      setError("New passwords do not match");
      return;
    }
    if (next.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error changing password");
      return;
    }

    setSuccess(true);
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  async function saveSsu(e: React.FormEvent) {
    e.preventDefault();
    setSsuLoading(true);
    setSsuSuccess(false);
    await fetch("/api/auth/ssu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ssuAddress }),
    });
    setSsuLoading(false);
    setSsuSuccess(true);
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Profile</h1>

      {/* SSU Address */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-base font-semibold text-gray-100 mb-1">Smart Storage Unit</h2>
        <p className="text-xs text-gray-500 mb-4">El inventario de este SSU se usará como stock en las calculadoras.</p>
        {ssuSuccess && (
          <div className="mb-4 rounded border border-green-800 bg-green-900/20 px-4 py-3 text-sm text-green-400">
            SSU address guardado.
          </div>
        )}
        <form onSubmit={saveSsu} className="flex gap-2">
          <input
            type="text"
            value={ssuAddress}
            onChange={(e) => { setSsuAddress(e.target.value); setSsuSuccess(false); }}
            placeholder="0x..."
            className="flex-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-cyan-600"
          />
          <button type="submit" disabled={ssuLoading} className="btn-sm btn-primary disabled:opacity-50">
            {ssuLoading ? "Guardando…" : "Guardar"}
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <p className="text-sm text-gray-400 mb-4">
          Logged in as <span className="font-medium text-gray-200">{user?.username}</span>
          {user?.role === "ADMIN" && (
            <span className="ml-2 text-xs text-cyan-500">ADMIN</span>
          )}
        </p>

        <h2 className="text-base font-semibold text-gray-100 mb-4">Change password</h2>

        {error && (
          <div className="mb-4 rounded border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded border border-green-800 bg-green-900/20 px-4 py-3 text-sm text-green-400">
            Password changed successfully.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Current password</label>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              className="input w-full"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">New password</label>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={6}
              className="input w-full"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              className="input w-full"
              autoComplete="new-password"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-sm btn-primary disabled:opacity-50">
            {loading ? "Saving…" : "Change password"}
          </button>
        </form>
      </div>
    </div>
  );
}
