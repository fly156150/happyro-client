/** Shared clockwise countdown: white before the last minute, orange within it. */
export function statusIconProgress(start, end, now) {
 if (!Number.isFinite(end)) return null;
 const remaining = Math.max(0, end - now);
 const finalMinute = remaining <= 60000;
 const fraction = finalMinute ? 1 - remaining / 60000 : (now - start) / (end - 60000 - start);
 return {
  fraction: Math.max(0, Math.min(1, fraction)),
  color: finalMinute ? 'rgba(255,150,50,0.65)' : 'rgba(255,255,255,0.65)'
 };
}
