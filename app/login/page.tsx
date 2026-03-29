"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConnection } from "@evefrontier/dapp-kit";
import { getWalletCharacters } from "@evefrontier/dapp-kit/graphql";

function VaultLoginButton() {
  const searchParams = useSearchParams();
  const { isConnected, hasEveVault, walletAddress, handleConnect, handleDisconnect } = useConnection();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVaultLogin() {
    setError(null);
    setLoading(true);
    try {
      if (!isConnected) {
        await handleConnect();
        // Connection triggers a re-render; the button will become "Sign in" after connecting
        setLoading(false);
        return;
      }

      if (!walletAddress) {
        setError("No wallet account selected");
        setLoading(false);
        return;
      }

      // 1. Get fresh nonce from server (proves request is recent, 5 min TTL)
      const nonceRes = await fetch("/api/auth/nonce");
      if (!nonceRes.ok) throw new Error("Failed to get nonce");
      const { nonce } = await nonceRes.json();

      // 2. Try to get character name from EVE Frontier GraphQL
      let characterName: string | undefined;
      try {
        const characters = await getWalletCharacters(walletAddress);
        characterName = characters?.[0]?.name ?? undefined;
      } catch {
        // Not critical — fall back to wallet address as display name
      }

      // 3. Authenticate with server
      const authRes = await fetch("/api/auth/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, characterName, nonce }),
      });

      if (!authRes.ok) {
        const data = await authRes.json();
        throw new Error(data.error ?? "Authentication failed");
      }

      const from = searchParams.get("from") ?? "/dashboard";
      window.location.href = from;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!hasEveVault) {
    return (
      <div className="text-center space-y-2">
        <p className="text-gray-400 text-sm">EVE Vault extension not detected.</p>
        <a
          href="https://evefrontier.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 text-xs hover:underline"
        >
          Get EVE Vault →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isConnected && walletAddress && (
        <div className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
          <span className="text-xs text-gray-400 font-mono truncate">{walletAddress.slice(0, 20)}…</span>
          <button
            onClick={handleDisconnect}
            className="text-xs text-gray-500 hover:text-gray-300 ml-2 shrink-0"
          >
            Disconnect
          </button>
        </div>
      )}

      <button
        onClick={handleVaultLogin}
        disabled={loading}
        className="w-full bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-medium py-2.5 rounded text-sm transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          "..."
        ) : isConnected ? (
          "Sign in with EVE Vault"
        ) : (
          "Connect EVE Vault"
        )}
      </button>

      {error && <p className="text-red-400 text-xs text-center">{error}</p>}
    </div>
  );
}

function AdminLoginForm() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);

  // Fetch registration status once on mount to show/hide Register tab
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setRegistrationOpen(d.registrationOpen ?? true))
      .catch(() => setRegistrationOpen(true));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    const from = searchParams.get("from") ?? "/dashboard";
    window.location.href = from;
  }

  const showRegisterTab = registrationOpen !== false;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      {showRegisterTab && (
        <div className="flex mb-6 bg-gray-800 rounded-md p-1">
          <button
            onClick={() => { setMode("login"); setError(null); }}
            className={`flex-1 py-1.5 text-sm font-medium rounded transition-colors ${
              mode === "login" ? "bg-gray-700 text-gray-100" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => { setMode("register"); setError(null); }}
            className={`flex-1 py-1.5 text-sm font-medium rounded transition-colors ${
              mode === "register" ? "bg-gray-700 text-gray-100" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Register
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-cyan-600"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 pr-10 text-sm text-gray-100 focus:outline-none focus:border-cyan-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-xs"
              tabIndex={-1}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-medium py-2 rounded text-sm transition-colors"
        >
          {loading ? "..." : mode === "login" ? "Login" : "Create account"}
        </button>
      </form>
    </div>
  );
}

function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-cyan-400 tracking-wide">EVE Frontier</h1>
          <p className="text-gray-500 text-sm mt-1">Industry Calculator</p>
        </div>

        {/* EVE Vault — primary login */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <p className="text-xs text-gray-400 text-center uppercase tracking-wider">Login with EVE Vault</p>
          <VaultLoginButton />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-xs text-gray-600">Admin access</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* Username/password — admin only */}
        <AdminLoginForm />
      </div>
    </div>
  );
}

export default function LoginPageWrapper() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}
