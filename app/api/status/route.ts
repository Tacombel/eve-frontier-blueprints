import { NextResponse } from "next/server";
import { getMetrics, recordIncident, getIncidentCount } from "@/lib/metrics";

export async function GET() {
  const metrics = getMetrics();
  const endpoints = Object.values(metrics);

  if (endpoints.length === 0) {
    return NextResponse.json({ status: "green", p95: 0 });
  }

  const maxP95 = Math.max(...endpoints.map((m) => m.p95));
  const totalErrors = endpoints.reduce((s, m) => s + m.errors, 0);
  const totalRecent = endpoints.reduce((s, m) => s + m.rpm, 0);
  const errorRate = totalRecent > 0 ? totalErrors / totalRecent : 0;

  let status: "green" | "yellow" | "red";
  if (maxP95 > 5000 || errorRate > 0.1) status = "red";
  else if (maxP95 > 2000 || errorRate > 0.05) status = "yellow";
  else status = "green";

  if (status !== "green") recordIncident();

  return NextResponse.json({ status, p95: maxP95, incidents24h: getIncidentCount(24) });
}
