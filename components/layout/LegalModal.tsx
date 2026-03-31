"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "legal_accepted_v1";

export default function LegalModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl bg-gray-900 border border-gray-700 shadow-2xl p-8 flex flex-col gap-6">

        <div>
          <h2 className="text-xl font-bold text-cyan-400 tracking-wide mb-1">EVE Frontier — Industry Calculator</h2>
          <p className="text-xs text-gray-500">Fan-made tool · Unofficial · Not affiliated with CCP hf.</p>
        </div>

        <div className="space-y-4 text-sm text-gray-300 leading-relaxed text-justify">
          <p>
            This is an <span className="text-gray-100 font-medium">unofficial, community-made tool</span> for EVE Frontier.
            It is not affiliated with, endorsed by, or connected to <span className="text-gray-100">CCP hf.</span> in any way.
          </p>
          <p>
            EVE Frontier and all related names, marks, and assets are trademarks or registered trademarks of
            <span className="text-gray-100"> CCP hf.</span> All rights reserved.
          </p>
          <div className="border-t border-gray-700 pt-4">
            <p className="font-medium text-gray-200 mb-1">Privacy</p>
            <p>
              All your data (stock, packs, blueprints) is stored on <span className="text-gray-100">private servers</span> under the same ownership.
              Data may be replicated across servers for availability, but is never shared with or sold to third parties. No analytics. No tracking.
            </p>
            <p className="mt-2">
              A single <span className="text-gray-100">functional cookie</span> is used to keep you logged in during your session.
              No tracking or advertising cookies are used.
            </p>
          </div>
          <div className="border-t border-gray-700 pt-4">
            <p className="font-medium text-gray-200 mb-1">Use at your own risk</p>
            <p>
              Game data may be incomplete or outdated. This tool is provided as-is, with no warranty of accuracy or availability.
            </p>
          </div>
        </div>

        <button
          onClick={accept}
          className="w-full rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-semibold py-2.5 transition-colors"
        >
          I understand — Enter
        </button>
      </div>
    </div>
  );
}
