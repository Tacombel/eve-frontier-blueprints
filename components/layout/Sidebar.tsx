"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import pkg from "@/package.json";
const version = pkg.version;

const navItems = [
  { href: "/decompositions", label: "Decompositions", icon: "🔩" },
  { href: "/items", label: "Items", icon: "⬡" },
  { href: "/blueprints", label: "Blueprints", icon: "📐" },
  { href: "/factories", label: "Factories", icon: "🏭" },
  { href: "/stock", label: "Stock", icon: "📦" },
  { href: "/packs", label: "Packs", icon: "🗃️" },
  { href: "/asteroids", label: "Asteroids", icon: "🪨" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 flex-col bg-gray-900 border-r border-gray-800">
      <div className="px-4 py-5 border-b border-gray-800">
        <h1 className="text-lg font-bold text-cyan-400 tracking-wide">EVE Frontier</h1>
        <p className="text-xs text-gray-500 mt-0.5">Industry Calculator</p>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
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
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-600">
        <p>v{version}</p>
        <p>© tacombel@gmail.com</p>
      </div>
    </aside>
  );
}
