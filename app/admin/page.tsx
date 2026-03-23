"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSession } from "@/hooks/useSession";

interface User {
  id: string;
  username: string;
  role: string;
  createdAt: string;
}

export default function AdminPage() {
  const { user: me, isSuperAdmin: amISuperAdmin } = useSession();

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userError, setUserError] = useState("");

  // Reset password inline state
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetCopied, setResetCopied] = useState(false);
  const [resetError, setResetError] = useState("");

  // Renormalize
  const [renormalizing, setRenormalizing] = useState(false);
  const [renormalizeResult, setRenormalizeResult] = useState<{ total: { renamed: number; duplicatesRemoved: number } } | null>(null);
  const [renormalizeError, setRenormalizeError] = useState("");

  async function loadUsers() {
    setUsersLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setUsersLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  async function setRole(user: User, newRole: string) {
    setUserError("");
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) {
      setUserError((await res.json()).error ?? "Error updating role");
      return;
    }
    await loadUsers();
  }

  async function deleteUser(user: User) {
    if (!confirm(`Delete user "${user.username}"? This will also delete all their stock and packs.`)) return;
    setUserError("");
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    if (!res.ok) {
      setUserError((await res.json()).error ?? "Error deleting user");
      return;
    }
    await loadUsers();
  }

  function generatePassword() {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const arr = new Uint8Array(14);
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => chars[b % chars.length]).join("");
  }

  async function openReset(userId: string) {
    const pw = generatePassword();
    setResetId(userId);
    setResetPw("");
    setResetCopied(false);
    setResetError("");
    const res = await fetch(`/api/admin/users/${userId}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: pw }),
    });
    const data = await res.json();
    if (!res.ok) {
      setResetError(data.error ?? "Error resetting password");
      return;
    }
    setResetPw(pw);
  }

  function cancelReset() {
    setResetId(null);
    setResetPw("");
    setResetCopied(false);
    setResetError("");
  }

  async function copyPassword() {
    await navigator.clipboard.writeText(resetPw);
    setResetCopied(true);
  }

  async function runRenormalize() {
    setRenormalizing(true);
    setRenormalizeResult(null);
    setRenormalizeError("");
    const res = await fetch("/api/admin/renormalize", { method: "POST" });
    const data = await res.json();
    if (!res.ok || data.error) setRenormalizeError(data.error ?? "Failed");
    else setRenormalizeResult(data);
    setRenormalizing(false);
  }

  const selfId = useMemo(
    () => users.find((x) => x.username === me?.username)?.id,
    [users, me]
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Admin</h1>

      {/* Users */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-base font-semibold text-gray-100 mb-4">Users</h2>

        {userError && (
          <div className="mb-4 rounded border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">{userError}</div>
        )}

        {usersLoading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800 text-left">
                <th className="pb-2 pr-4">Username</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2 pr-4">Registered</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = selfId === u.id;
                const isTargetSA = u.role === "SUPERADMIN";
                const isResetting = resetId === u.id;

                // ADMIN cannot touch a SUPERADMIN
                const canTouch = amISuperAdmin || !isTargetSA;

                // Reset password: cannot reset own, cannot touch SA unless actor is SA
                const canReset = !isSelf && canTouch;
                const resetDisabledTitle = !canTouch
                  ? "Only a superadmin can reset a superadmin's password"
                  : isSelf
                  ? "You cannot reset your own password here"
                  : undefined;

                // Delete: ADMIN cannot delete self; SA can delete self if backend allows it
                const canDelete = canTouch && (!isSelf || amISuperAdmin);
                const deleteDisabledTitle = !canTouch
                  ? "Only a superadmin can delete a superadmin"
                  : isSelf && !amISuperAdmin
                  ? "You cannot delete your own account"
                  : undefined;

                return (
                  <Fragment key={u.id}>
                    <tr className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2 pr-4 font-medium text-gray-200">
                        {u.username}
                        {isSelf && <span className="ml-2 text-xs text-gray-600">(you)</span>}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`badge ${
                          u.role === "SUPERADMIN"
                            ? "badge-amber"
                            : u.role === "ADMIN"
                            ? "badge-cyan"
                            : "badge-gray"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-500 text-xs">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 text-right space-x-2">
                        <button
                          onClick={() => isResetting ? cancelReset() : openReset(u.id)}
                          title={resetDisabledTitle ?? "Reset password"}
                          disabled={!canReset || (isResetting && !resetPw && !resetError)}
                          className={`btn-ghost text-xs disabled:opacity-30 disabled:cursor-not-allowed ${isResetting ? "text-gray-500" : ""}`}
                        >
                          {isResetting && !resetPw && !resetError ? "Resetting…" : isResetting ? "Cancel" : "Reset password"}
                        </button>

                        {/* Role buttons */}
                        {u.role === "USER" && (
                          <button
                            onClick={() => setRole(u, "ADMIN")}
                            disabled={isSelf}
                            title={isSelf ? "You cannot change your own role" : "Promote to ADMIN"}
                            className="btn-ghost text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ↑ ADMIN
                          </button>
                        )}
                        {u.role === "ADMIN" && (
                          <>
                            <button
                              onClick={() => setRole(u, "USER")}
                              disabled={isSelf}
                              title={isSelf ? "You cannot change your own role" : "Demote to USER"}
                              className="btn-ghost text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              ↓ USER
                            </button>
                            {amISuperAdmin && (
                              <button
                                onClick={() => setRole(u, "SUPERADMIN")}
                                disabled={isSelf}
                                title={isSelf ? "You cannot change your own role" : "Promote to SUPERADMIN"}
                                className="btn-ghost text-xs text-amber-500 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                ↑ SA
                              </button>
                            )}
                          </>
                        )}
                        {u.role === "SUPERADMIN" && amISuperAdmin && (
                          <button
                            onClick={() => setRole(u, "ADMIN")}
                            disabled={isSelf}
                            title={isSelf ? "You cannot change your own role" : "Demote to ADMIN"}
                            className="btn-ghost text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ↓ ADMIN
                          </button>
                        )}

                        <button
                          onClick={() => deleteUser(u)}
                          disabled={!canDelete}
                          title={deleteDisabledTitle ?? `Delete ${u.username}`}
                          className="btn-ghost btn-danger text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Del
                        </button>
                      </td>
                    </tr>
                    {isResetting && (
                      <tr className="border-b border-gray-800/50 bg-gray-800/20">
                        <td colSpan={4} className="px-2 py-3">
                          {resetError ? (
                            <p className="text-xs text-red-400">{resetError}</p>
                          ) : resetPw ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 shrink-0">
                                New password for <span className="text-gray-200">{u.username}</span>:
                              </span>
                              <code className="flex-1 min-w-0 font-mono text-sm text-cyan-300 bg-gray-950 border border-gray-700 rounded px-2 py-1 truncate select-all">
                                {resetPw}
                              </code>
                              <button
                                onClick={copyPassword}
                                className="btn-ghost text-xs shrink-0"
                                title="Copy to clipboard"
                              >
                                {resetCopied ? "Copied!" : "Copy"}
                              </button>
                              <button onClick={cancelReset} className="btn-ghost text-xs text-gray-500 shrink-0">
                                Done
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">Applying…</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Fix capitalization */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-base font-semibold text-gray-100 mb-1">Fix name capitalization</h2>
        <p className="text-sm text-gray-500 mb-4">
          Re-applies name normalization to all existing records.
          Removes duplicates caused by previous inconsistent capitalization (keeps the correctly-cased version).
        </p>
        <button onClick={runRenormalize} disabled={renormalizing} className="btn-sm btn-primary disabled:opacity-50">
          {renormalizing ? "Fixing…" : "Fix capitalization"}
        </button>
        {renormalizeError && (
          <div className="mt-4 rounded border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">{renormalizeError}</div>
        )}
        {renormalizeResult && (
          <div className="mt-4 rounded border border-green-800 bg-green-900/20 px-4 py-3 text-sm">
            <p className="font-medium text-green-400">Done</p>
            <p className="text-xs text-gray-400 mt-1">{renormalizeResult.total.renamed} renamed · {renormalizeResult.total.duplicatesRemoved} duplicates removed</p>
          </div>
        )}
      </div>
    </div>
  );
}
