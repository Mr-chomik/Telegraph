/**
 * Collection freshness window.
 *
 * Only fresh information should ever reach the pipeline:
 *   - first run (no prior sync): at most 24 hours back;
 *   - afterwards: the interval between editions (what the next edition needs).
 */

const toMinutes = (value: string): number => {
  const [h, m] = value.split(":").map((s) => Number.parseInt(s ?? "0", 10));
  const hh = typeof h === "number" && Number.isFinite(h) ? h : 0;
  const mm = typeof m === "number" && Number.isFinite(m) ? m : 0;
  return hh * 60 + mm;
};

/** Largest gap (hours) between consecutive edition slots, including the
 * overnight wrap-around. e.g. ["08:00","13:00","19:00"] → 13h (19:00→08:00).
 * A single slot means one edition per day → 24h. */
export function editionIntervalHours(times: string[]): number {
  const minutes = times.map(toMinutes).sort((a, b) => a - b);
  if (minutes.length === 0) return 24;
  if (minutes.length === 1) return 24;
  let maxGap = 0;
  for (let i = 0; i < minutes.length; i += 1) {
    const a = minutes[i]!;
    const b = minutes[(i + 1) % minutes.length]!;
    const gap = (b - a + 24 * 60) % (24 * 60);
    maxGap = Math.max(maxGap, gap);
  }
  return Math.max(1, Math.ceil(maxGap / 60));
}

/** Freshness window in hours for a stage that hasn't run before (`firstRun`). */
export function fetchFreshnessHours(opts: { firstRun: boolean; editionTimes: string[] }): number {
  return opts.firstRun ? 24 : editionIntervalHours(opts.editionTimes);
}