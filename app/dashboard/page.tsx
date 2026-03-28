"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  const [activeTab, setActiveTab] = useState<TabType>('blueprints');
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setRole(data?.role ?? null))
      .catch(() => setRole(null));
  }, []);

  return (
    <div className="flex flex-col h-full -mx-6 -my-6">
      {/* Tab buttons bar */}
      <div className="flex items-center gap-0 border-b border-gray-800 px-6 py-4 bg-gray-950 flex-shrink-0">
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

        {/* Admin link - right side */}
        {(role === "ADMIN" || role === "SUPERADMIN") && (
          <div className="ml-auto">
            <Link
              href="/admin"
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-100 hover:bg-gray-800/30 rounded transition-colors"
            >
              ⚙️ Admin
            </Link>
          </div>
        )}
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
