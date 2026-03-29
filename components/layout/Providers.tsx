"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState, Component, ReactNode } from "react";

// EveFrontierProvider accesses `window` at module level — must be loaded client-only
const EveFrontierProviderNoSSR = dynamic(
  () => import("@evefrontier/dapp-kit").then((m) => ({ default: m.EveFrontierProvider })),
  { ssr: false }
);

// Catches wallet connection errors (e.g. "Connection request timed out") so they
// don't propagate as unhandled runtime errors and crash the page.
class WalletErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };

  static getDerivedStateFromError() {
    return { error: true };
  }

  componentDidCatch(error: Error) {
    // Clear the auto-connect flag so the next load doesn't retry immediately
    if (typeof window !== "undefined") {
      localStorage.removeItem("eve-dapp-connected");
    }
    console.warn("[WalletErrorBoundary] Wallet provider error (suppressed):", error.message);
  }

  render() {
    // If the wallet provider crashed, render children without it
    // (app still works, just without wallet features)
    if (this.state.error) return this.props.children;
    return this.props.children;
  }
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <WalletErrorBoundary>
        <EveFrontierProviderNoSSR queryClient={queryClient}>
          {children}
        </EveFrontierProviderNoSSR>
      </WalletErrorBoundary>
    </QueryClientProvider>
  );
}
