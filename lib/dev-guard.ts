import { NextResponse } from "next/server";

/**
 * Returns a 403 response if not running in development mode.
 * Use in API route mutations for static game data (items, blueprints, etc.)
 * to prevent accidental changes in production.
 */
export function requireDev(): NextResponse | null {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "This operation is only available in development mode" },
      { status: 403 }
    );
  }
  return null;
}
