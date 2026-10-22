"use client";

import { useEffect, useRef, useState } from "react";

function useMsLeft(deadline: string, serverNow?: string) {
  const skew = useRef(serverNow ? new Date(serverNow).getTime() - Date.now() : 0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, new Date(deadline).getTime() - (now + skew.current));
}

const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Display-only countdown; expiry itself is enforced by the server. */
export function Countdown({ deadline, serverNow }: { deadline: string; serverNow?: string }) {
  const ms = useMsLeft(deadline, serverNow);
  return (
    <span className={`font-mono text-sm font-bold tabular-nums ${ms < 60_000 ? "text-red-600" : "text-orange-600"}`}>
      {ms === 0 ? "0:00" : fmt(ms)}
    </span>
  );
}

/** Countdown with a draining progress bar over the 5-minute response window. */
export function CountdownBar({ deadline, serverNow, windowMs = 300_000 }: { deadline: string; serverNow?: string; windowMs?: number }) {
  const ms = useMsLeft(deadline, serverNow);
  const pct = Math.max(0, Math.min(100, (ms / windowMs) * 100));
  const urgent = ms < 60_000;
  return (
    <div className="w-full">
      <div className="flex justify-end">
        <span className={`font-mono text-sm font-bold tabular-nums ${urgent ? "text-red-600" : "text-orange-600"}`}>{fmt(ms)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Time left to respond"
        aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${urgent ? "bg-red-500" : "bg-orange-500"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
