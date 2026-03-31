interface Sample {
  ts: number;
  ms: number;
  ok: boolean;
}

const BUFFER_SIZE = 200;
const store = new Map<string, Sample[]>();

export function recordRequest(endpoint: string, ms: number, ok: boolean) {
  const samples = store.get(endpoint) ?? [];
  samples.push({ ts: Date.now(), ms, ok });
  if (samples.length > BUFFER_SIZE) samples.shift();
  store.set(endpoint, samples);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function getMetrics() {
  const now = Date.now();
  const result: Record<string, {
    total: number;
    rpm: number;
    errors: number;
    p50: number;
    p95: number;
    lastMs: number;
  }> = {};

  for (const [endpoint, samples] of store) {
    const recent = samples.filter((s) => now - s.ts < 60_000);
    const sorted = recent.map((s) => s.ms).sort((a, b) => a - b);
    result[endpoint] = {
      total: samples.length,
      rpm: recent.length,
      errors: recent.filter((s) => !s.ok).length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      lastMs: samples.at(-1)?.ms ?? 0,
    };
  }

  return result;
}
