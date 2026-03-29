"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import VaultLoginButton from "@/components/auth/VaultLoginButton";
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
    setUsername(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col h-full -mx-6 -my-6">
      {/* App header */}
      <div className="px-6 py-3 bg-gray-950 border-b border-gray-800 flex-shrink-0 text-center">
        <h1 className="text-lg font-bold text-cyan-400 tracking-wide">EF Industry</h1>
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
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-100 hover:bg-gray-800/30 rounded transition-colors"
            >
              ⚙️ Admin
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
