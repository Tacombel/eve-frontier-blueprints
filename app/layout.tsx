import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import UpdateBanner from "@/components/layout/UpdateBanner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EVE Frontier — Industry",
  description: "Blueprint and production calculator for EVE Frontier",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-gray-950 text-gray-100 antialiased`}>
        <div className="flex h-full">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <UpdateBanner />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
