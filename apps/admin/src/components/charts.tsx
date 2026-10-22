"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTr } from "@/lib/i18n";

/*
 * Small SVG chart kit. Charts render at the container's real pixel width (no stretched text),
 * keep axes/grid recessive, show a hover tooltip, and always offer a table view.
 * Series colors: brand blue for single-series charts; validated categorical slots for the donut.
 */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(v: number, integers: boolean) {
  if (v <= 0) return integers ? 4 : 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 4, 5, 10]) if (m * p >= v) return integers ? Math.max(4, Math.ceil(m * p)) : m * p;
  return 10 * p;
}

const shortDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

function ChartFrame({ label, asTable, setAsTable, table, children, summary }: {
  label: string; asTable: boolean; setAsTable: (v: boolean) => void; table: ReactNode; children: ReactNode; summary?: ReactNode;
}) {
  const tr = useTr();
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="min-w-0">{summary}</div>
        <button onClick={() => setAsTable(!asTable)} className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">
          {asTable ? tr("Show chart") : tr("View as table")}
        </button>
      </div>
      {asTable ? <div className="max-h-64 overflow-y-auto">{table}</div> : <div aria-label={label}>{children}</div>}
    </div>
  );
}

function SeriesTable({ rows, label, format }: { rows: Array<{ x: string; y: number }>; label: string; format: (v: number) => string }) {
  const tr = useTr();
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs text-ink-3"><th className="py-1.5 font-semibold">{tr("Day")}</th><th className="py-1.5 text-right font-semibold">{tr(label)}</th></tr></thead>
      <tbody>{rows.map((d) => <tr key={d.x} className="border-t border-line-soft"><td className="py-1.5">{shortDay(d.x)}</td><td className="py-1.5 text-right font-medium tabular-nums">{format(d.y)}</td></tr>)}</tbody>
    </table>
  );
}

type Point = { x: string; y: number };

/** Single-series time chart: 2px line over a soft area, crosshair + tooltip on hover/focus. */
export function AreaChart({ data, label, format = (v) => String(v), height = 220, summary }: {
  data: Point[]; label: string; format?: (v: number) => string; height?: number; summary?: ReactNode;
}) {
  const tr = useTr();
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const padL = 44, padR = 12, padT = 12, padB = 26;
  const max = niceMax(Math.max(...data.map((d) => d.y), 0), data.every((d) => Number.isInteger(d.y)));
  const innerW = Math.max(0, W - padL - padR), innerH = height - padT - padB;
  const x = (i: number) => padL + (data.length <= 1 ? innerW / 2 : (innerW * i) / (data.length - 1));
  const y = (v: number) => padT + innerH * (1 - v / max);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.y)}`).join(" ");
  const area = data.length ? `${line} L${x(data.length - 1)},${padT + innerH} L${x(0)},${padT + innerH} Z` : "";
  const ticks = [0, max / 2, max];
  const step = Math.ceil(data.length / Math.max(2, Math.floor(innerW / 70)));

  const onMove = (clientX: number, rect: DOMRect) => {
    const rel = clientX - rect.left - padL;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round((rel / Math.max(1, innerW)) * (data.length - 1)))));
  };

  return (
    <ChartFrame label={tr(label)} asTable={asTable} setAsTable={setAsTable} summary={summary}
      table={<SeriesTable rows={data} label={label} format={format} />}>
      <div ref={ref} className="relative" style={{ height }}>
        {W > 0 && (
          <svg width={W} height={height} role="img" aria-label={`${tr(label)}: ${data.length} days`}
            onMouseMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())} onMouseLeave={() => setHover(null)}
            tabIndex={0} onKeyDown={(e) => {
              if (e.key === "ArrowRight") setHover((h) => Math.min(data.length - 1, (h ?? -1) + 1));
              if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? data.length) - 1));
            }} onBlur={() => setHover(null)} className="outline-none">
            <defs>
              <linearGradient id="fn-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#EEF0F3" />
                <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#64748B">{format(t)}</text>
              </g>
            ))}
            <path d={area} fill="url(#fn-area)" />
            <path d={line} fill="none" stroke="#2563EB" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {data.map((d, i) => i % step === 0 && (
              <text key={d.x} x={x(i)} y={height - 6} textAnchor="middle" fontSize="11" fill="#64748B">{shortDay(d.x)}</text>
            ))}
            {hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH} stroke="#94A3B8" strokeDasharray="3 3" />
                <circle cx={x(hover)} cy={y(data[hover].y)} r={5} fill="#2563EB" stroke="#fff" strokeWidth={2} />
              </g>
            )}
          </svg>
        )}
        {hover !== null && W > 0 && (
          <div className="pointer-events-none absolute top-0 z-10 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-pop)]"
            style={{ left: Math.min(Math.max(x(hover), 70), W - 70), transform: "translateX(-50%)" }}>
            <p className="text-ink-3">{shortDay(data[hover].x)}</p>
            <p className="font-semibold tabular-nums text-ink">{format(data[hover].y)}</p>
          </div>
        )}
      </div>
    </ChartFrame>
  );
}

/** Single-series column chart with rounded data-ends and a per-bar tooltip. */
export function BarChart({ data, label, format = (v) => String(v), height = 220, summary }: {
  data: Point[]; label: string; format?: (v: number) => string; height?: number; summary?: ReactNode;
}) {
  const tr = useTr();
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const padL = 36, padR = 8, padT = 12, padB = 26;
  const max = niceMax(Math.max(...data.map((d) => d.y), 0), data.every((d) => Number.isInteger(d.y)));
  const innerW = Math.max(0, W - padL - padR), innerH = height - padT - padB;
  const bw = data.length ? innerW / data.length : 0;
  const barW = Math.max(4, Math.min(24, bw * 0.6));
  const y = (v: number) => padT + innerH * (1 - v / max);
  const ticks = [0, max / 2, max];
  const step = Math.ceil(data.length / Math.max(2, Math.floor(innerW / 60)));

  return (
    <ChartFrame label={tr(label)} asTable={asTable} setAsTable={setAsTable} summary={summary}
      table={<SeriesTable rows={data} label={label} format={format} />}>
      <div ref={ref} className="relative" style={{ height }}>
        {W > 0 && (
          <svg width={W} height={height} role="img" aria-label={`${tr(label)}: ${data.length} days`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#EEF0F3" />
                <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#64748B">{format(t)}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = padL + bw * i + bw / 2;
              const top = y(d.y);
              const h = padT + innerH - top;
              const r = Math.min(4, h, barW / 2);
              return (
                <g key={d.x} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={padL + bw * i} y={padT} width={bw} height={innerH} fill="transparent" />
                  {h > 0 && (
                    <path fill="#2563EB" opacity={hover === null || hover === i ? 1 : 0.4}
                      d={`M${cx - barW / 2},${top + h} V${top + r} Q${cx - barW / 2},${top} ${cx - barW / 2 + r},${top} H${cx + barW / 2 - r} Q${cx + barW / 2},${top} ${cx + barW / 2},${top + r} V${top + h} Z`} />
                  )}
                  {i % step === 0 && <text x={cx} y={height - 6} textAnchor="middle" fontSize="11" fill="#64748B">{shortDay(d.x)}</text>}
                </g>
              );
            })}
          </svg>
        )}
        {hover !== null && W > 0 && (
          <div className="pointer-events-none absolute top-0 z-10 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-pop)]"
            style={{ left: Math.min(Math.max(padL + bw * hover + bw / 2, 60), W - 60), transform: "translateX(-50%)" }}>
            <p className="text-ink-3">{shortDay(data[hover].x)}</p>
            <p className="font-semibold tabular-nums text-ink">{format(data[hover].y)} <span className="font-normal text-ink-3">{tr(label).toLowerCase()}</span></p>
          </div>
        )}
      </div>
    </ChartFrame>
  );
}

export interface Slice { label: string; value: number; color: string }

/** Donut with ≤4 grouped slices, 2px surface gaps, total in the centre and a direct-labelled legend. */
export function Donut({ slices, centerLabel }: { slices: Slice[]; centerLabel: string }) {
  const tr = useTr();
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((a, s) => a + s.value, 0);
  const R = 70, r = 48, C = 90;
  let angle = -Math.PI / 2;
  const arcs = slices.map((s) => {
    const frac = total ? s.value / total : 0;
    const start = angle;
    const end = angle + frac * Math.PI * 2;
    angle = end;
    return { ...s, frac, start, end };
  });
  const arcPath = (a0: number, a1: number) => {
    const gap = 0.02; // surface gap between segments
    const s = a0 + gap / 2, e = Math.max(s, a1 - gap / 2);
    const large = e - s > Math.PI ? 1 : 0;
    const p = (rad: number, ang: number) => `${C + rad * Math.cos(ang)},${C + rad * Math.sin(ang)}`;
    return `M${p(R, s)} A${R},${R} 0 ${large} 1 ${p(R, e)} L${p(r, e)} A${r},${r} 0 ${large} 0 ${p(r, s)} Z`;
  };
  return (
    <div className="@container">
    <div className="flex flex-col items-center gap-5 @md:flex-row">
      <svg viewBox="0 0 180 180" className="h-40 w-40 shrink-0" role="img"
        aria-label={`${tr(centerLabel)}: ${total}. ${arcs.map((a) => `${tr(a.label)} ${a.value}`).join(", ")}`}>
        {total === 0 && <circle cx={C} cy={C} r={(R + r) / 2} fill="none" stroke="#EEF0F3" strokeWidth={R - r} />}
        {arcs.map((a, i) => a.value > 0 && (
          a.frac >= 0.999
            ? <circle key={a.label} cx={C} cy={C} r={(R + r) / 2} fill="none" style={{ stroke: a.color }} strokeWidth={R - r} />
            : <path key={a.label} d={arcPath(a.start, a.end)} style={{ fill: a.color }} opacity={hover === null || hover === i ? 1 : 0.35}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
        <text x={C} y={C - 2} textAnchor="middle" fontSize="26" fontWeight="700" fill="#0F172A">{hover === null ? total : arcs[hover].value}</text>
        <text x={C} y={C + 18} textAnchor="middle" fontSize="11" fill="#64748B">{hover === null ? tr(centerLabel) : tr(arcs[hover].label)}</text>
      </svg>
      <ul className="w-full min-w-0 flex-1 space-y-2.5">
        {arcs.map((a, i) => (
          <li key={a.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            className={`flex items-center gap-3 rounded-lg px-2 py-1 text-sm transition ${hover === i ? "bg-slate-50" : ""}`}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: a.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-ink-2">{tr(a.label)}</span>
            <span className="font-semibold tabular-nums text-ink">{a.value}</span>
            <span className="w-10 text-right text-xs tabular-nums text-ink-3">{total ? Math.round(a.frac * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
    </div>
  );
}

/** Horizontal labelled bars for a category breakdown (identity carried by the text label, not color). */
export function HBars({ rows, total }: { rows: Array<{ label: string; value: number }>; total: number }) {
  const tr = useTr();
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="mb-1 flex justify-between gap-3">
            <span className="truncate text-ink-2">{tr(r.label)}</span>
            <span className="font-semibold tabular-nums text-ink">{r.value}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${total ? Math.max(2, (r.value / total) * 100) : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
