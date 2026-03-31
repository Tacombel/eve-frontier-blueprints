"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";

const VaultLoginButton = dynamic(() => import("@/components/auth/VaultLoginButton"), { ssr: false });
import BlueprintPacksTab from "@/components/dashboard/BlueprintPacksTab";
import PacksTab from "@/components/dashboard/PacksTab";
import DecompositionsTab from "@/components/dashboard/DecompositionsTab";
import SsuTab from "@/components/dashboard/SsuTab";

type TabType = 'blueprints' | 'packs' | 'decompositions' | 'ssu';

const tabConfig: Record<TabType, { label: string }> = {
  blueprints: { label: '📐 Blueprints' },
  packs: { label: '🗃️ Packs' },
  decompositions: { label: '🔩 Decompositions' },
  ssu: { label: '🛰️ SSU Inventory' },
};

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('blueprints');
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState<"green" | "yellow" | "red" | null>(null);
  const [incidents24h, setIncidents24h] = useState(0);

  useEffect(() => {
    const fetchStatus = () => fetch("/api/status").then((r) => r.json()).then((d) => {
      setApiStatus(d.status);
      setIncidents24h(d.incidents24h ?? 0);
    }).catch(() => setApiStatus("red"));
    fetchStatus();
    const id = setInterval(fetchStatus, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUsername(data?.username ?? null);
        setRole(data?.role ?? null);
      })
      .catch(() => {
        setUsername(null);
        setRole(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("eve-dapp-connected");
    localStorage.removeItem("mysten-dapp-kit:selected-wallet-and-address");
    setUsername(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col h-full -mx-6 -my-6">
      {/* App header */}
      <div className="px-6 py-3 bg-gray-950 border-b border-gray-800 flex-shrink-0 flex items-center justify-center gap-3 relative">
        <Image src="/EF-Industry.png" alt="EF Industry" width={36} height={36} className="rounded-lg" />
        <h1 className="text-lg font-bold text-cyan-400 tracking-wide">EF Industry</h1>
        {apiStatus && (
          <span
            className="absolute right-4 flex items-center gap-1.5"
            title={apiStatus === "green" ? "API operational" : apiStatus === "yellow" ? "API degraded" : "API slow or errors"}
          >
            <span className={`inline-block w-2 h-2 rounded-full ${
              apiStatus === "green" ? "bg-green-400" : apiStatus === "yellow" ? "bg-yellow-400" : "bg-red-400"
            }`} />
            <span className={`text-xs ${
              apiStatus === "green" ? "text-green-600" : apiStatus === "yellow" ? "text-yellow-500" : "text-red-400"
            }`}>
              {apiStatus === "green" ? "API ok" : apiStatus === "yellow" ? "API slow" : "API err"}
            </span>
          </span>
        )}
      </div>

      {/* Tab buttons bar */}
      <div className="flex items-center gap-0 border-b border-gray-800 px-6 py-4 bg-gray-950 flex-shrink-0">
        {/* Tabs centered */}
        <div className="flex-1 flex justify-center gap-0">
          {(Object.keys(tabConfig) as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? 'text-cyan-300 border-cyan-400 bg-cyan-900/30'
                  : 'text-gray-400 border-transparent hover:text-gray-100 hover:bg-gray-800/30'
              }`}
            >
              {tabConfig[tab].label}
            </button>
          ))}
        </div>

        {/* Admin and auth links - right side */}
        <div className="flex items-center gap-2">
          {(role === "ADMIN" || role === "SUPERADMIN") && (
            <Link
              href="/admin"
              className="relative px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-100 hover:bg-gray-800/30 rounded transition-colors"
              title={incidents24h > 0 ? `${incidents24h} API incident(s) in the last 24h` : undefined}
            >
              ⚙️ Admin
              {incidents24h > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {incidents24h > 9 ? "9+" : incidents24h}
                </span>
              )}
            </Link>
          )}

          {authLoading ? null : username ? (
            <div className="flex items-center gap-2 pl-2 border-l border-gray-800">
              <Link
                href="/profile"
                className="text-sm text-gray-400 hover:text-cyan-300 hover:bg-gray-800/30 px-3 py-2 rounded transition-colors cursor-pointer"
                title="Change password"
              >
                👤 {username}
              </Link>
              <button
                onClick={handleLogout}
                className="px-3 py-2 text-sm font-medium text-gray-400 hover:text-gray-100 hover:bg-gray-800/30 rounded transition-colors"
                title="Logout"
              >
                ⏻
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pl-2 border-l border-gray-800">
              <VaultLoginButton compact redirectTo="/dashboard" />
              <Link
                href="/login"
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                title="Admin login"
              >
                Admin
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Tab content area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {activeTab === 'blueprints' && <BlueprintPacksTab />}
        {activeTab === 'packs' && <PacksTab />}
        {activeTab === 'decompositions' && <DecompositionsTab />}
        {activeTab === 'ssu' && <SsuTab />}
      </div>
    </div>
  );
}
