"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import pkg from "@/package.json";
const version = pkg.version;

const mainNavItems = [
  { href: "/ssu", label: "SSU", icon: "🛰️" },
  { href: "/decompositions", label: "Decompositions", icon: "🔩" },
  { href: "/blueprints", label: "Blueprints", icon: "📐" },
  { href: "/packs", label: "Packs", icon: "🗃️" },
];

const adminNavItems = [
  { href: "/items", label: "Items", icon: "⬡" },
  { href: "/asteroids", label: "Asteroids", icon: "🪨" },
  { href: "/factories", label: "Factories", icon: "🏭" },
  { href: "/refineries", label: "Refineries", icon: "⚗️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // Hide sidebar on dashboard
  if (pathname === '/dashboard' || pathname === '/') {
    return null;
  }
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [blueprintCount, setBlueprintCount] = useState<number | null>(null);
  const [decompositionCount, setDecompositionCount] = useState<number | null>(null);
  const [factoryCount, setFactoryCount] = useState<number | null>(null);
  const [refineryCount, setRefineryCount] = useState<number | null>(null);
  const [asteroidCount, setAsteroidCount] = useState<number | null>(null);
  const [packCount, setPackCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => { setUsername(data?.username ?? null); setRole(data?.role ?? null); })
      .catch(() => { setUsername(null); setRole(null); });

    Promise.all([fetch("/api/items"), fetch("/api/blueprints"), fetch("/api/decompositions"), fetch("/api/factories"), fetch("/api/refineries"), fetch("/api/asteroids"), fetch("/api/packs")])
      .then(([iRes, bRes, dRes, fRes, rRes, aRes, pRes]) => Promise.all([iRes.json(), bRes.json(), dRes.json(), fRes.json(), rRes.json(), aRes.json(), pRes.json()]))
      .then(([items, blueprints, decompositions, factories, refineries, asteroids, packs]) => {
        setItemCount(items.length);
        setBlueprintCount(blueprints.length);
        setDecompositionCount(decompositions.length);
        setFactoryCount(factories.length);
        setRefineryCount(refineries.length);
        setAsteroidCount(asteroids.length);
        setPackCount(packs.length);
      })
      .catch(() => {
        setItemCount(null);
        setBlueprintCount(null);
        setDecompositionCount(null);
        setFactoryCount(null);
        setRefineryCount(null);
        setAsteroidCount(null);
        setPackCount(null);
      });
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUsername(null);
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-56 flex-col bg-gray-900 border-r border-gray-800">
      <div className="px-4 py-5 border-b border-gray-800">
        <h1 className="text-lg font-bold text-cyan-400 tracking-wide">EVE Frontier</h1>
        <p className="text-xs text-gray-500 mt-0.5">Industry Calculator</p>
      </div>

      <nav className="flex-1 flex flex-col">
        {/* Main navigation items */}
        <div className="px-2 py-4 space-y-1">
          {mainNavItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const count = item.label === "Blueprints" ? blueprintCount : item.label === "Decompositions" ? decompositionCount : item.label === "Packs" ? packCount : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-cyan-900/50 text-cyan-300"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                }`}
              >
                <span className="w-5 text-center shrink-0">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {count !== null && <span className="text-xs text-gray-500">{count}</span>}
              </Link>
            );
          })}
        </div>

        {/* Admin navigation items */}
        <div className="px-2 py-4 space-y-1 border-t border-gray-800">
          {adminNavItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const count = item.label === "Items" ? itemCount : item.label === "Factories" ? factoryCount : item.label === "Refineries" ? refineryCount : item.label === "Asteroids" ? asteroidCount : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-cyan-900/50 text-cyan-300"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                }`}
              >
                <span className="w-5 text-center shrink-0">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {count !== null && <span className="text-xs text-gray-500">{count}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="px-2 pb-2 space-y-1">
        <Link
          href="/profile"
          className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            pathname === "/profile"
              ? "bg-cyan-900/50 text-cyan-300"
              : "text-gray-600 hover:bg-gray-800 hover:text-gray-400"
          }`}
        >
          <span className="w-5 text-center shrink-0">👤</span>
          Profile
        </Link>
      </div>

      {(role === "ADMIN" || role === "SUPERADMIN") && (
        <div className="px-2 pb-2 space-y-1">
          <Link
            href="/admin"
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              pathname === "/admin"
                ? "bg-cyan-900/50 text-cyan-300"
                : "text-gray-600 hover:bg-gray-800 hover:text-gray-400"
            }`}
          >
            <span className="w-5 text-center shrink-0">⚙</span>
            Admin
          </Link>
          <Link
            href="/admin/backup"
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              pathname.startsWith("/admin/backup")
                ? "bg-cyan-900/50 text-cyan-300"
                : "text-gray-600 hover:bg-gray-800 hover:text-gray-400"
            }`}
          >
            <span className="w-5 text-center shrink-0">💾</span>
            Backup
          </Link>
        </div>
      )}

      <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-600">
        {username ? (
          <div className="flex items-center justify-between mb-1">
            <Link href="/profile" className="text-gray-400 hover:text-gray-200 transition-colors truncate" title={username}>
              {username}
              {role === "SUPERADMIN" && <span className="ml-1 text-amber-500 text-[10px]">SUPERADMIN</span>}
              {role === "ADMIN" && <span className="ml-1 text-cyan-600 text-[10px]">ADMIN</span>}
            </Link>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-300 transition-colors ml-2 shrink-0"
              title="Logout"
            >
              ⏻
            </button>
          </div>
        ) : (
          <Link href="/login" className="text-gray-500 hover:text-gray-300 transition-colors block mb-1">
            Login
          </Link>
        )}
        <p>v{version}</p>
        <p>© tacombel@gmail.com</p>
      </div>
    </aside>
  );
}
