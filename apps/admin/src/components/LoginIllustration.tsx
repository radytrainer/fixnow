"use client";

import { BadgeCheck, Clock3, Wallet, type LucideIcon } from "lucide-react";
import { useTr } from "@/lib/i18n";

function FloatCard({ icon: Icon, tone, title, subtitle, className }: {
  icon: LucideIcon; tone: string; title: string; subtitle: string; className: string;
}) {
  const tr = useTr();
  return (
    <div className={`absolute flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 shadow-[0_18px_40px_-12px_rgb(2_6_23/0.55)] ${className}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" aria-hidden /></span>
      <span className="leading-tight">
        <span className="block text-[13px] font-bold text-ink">{tr(title)}</span>
        <span className="block text-[11px] text-ink-3">{tr(subtitle)}</span>
      </span>
    </div>
  );
}

/** Decorative admin scene: a mini FixNow dashboard with three live-operations cards floating around it. */
export function LoginIllustration() {
  const bars = [38, 52, 44, 66, 58, 80, 72, 96];
  return (
    <div className="relative mx-auto w-full max-w-[520px] [@media(max-height:860px)]:max-w-[400px]" aria-hidden>
      <svg viewBox="0 0 520 340" className="w-full drop-shadow-[0_30px_50px_rgba(2,6,23,0.45)]">
        {/* window */}
        <rect x="20" y="20" width="480" height="300" rx="18" fill="#FFFFFF" />
        <path d="M20 38a18 18 0 0 1 18-18h444a18 18 0 0 1 18 18v14H20z" fill="#F1F4FA" />
        {["#F87171", "#FBBF24", "#34D399"].map((c, i) => <circle key={c} cx={40 + i * 16} cy="36" r="5" fill={c} />)}
        <rect x="200" y="30" width="120" height="12" rx="6" fill="#E2E8F0" />

        {/* sidebar */}
        <rect x="20" y="52" width="92" height="268" fill="#F8FAFD" />
        <rect x="34" y="68" width="22" height="22" rx="6" fill="#2563EB" />
        <rect x="62" y="74" width="36" height="9" rx="4.5" fill="#CBD5E1" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i}>
            <rect x="34" y={110 + i * 26} width="12" height="12" rx="3" fill={i === 0 ? "#2563EB" : "#CBD5E1"} />
            <rect x="52" y={113 + i * 26} width={i === 0 ? 46 : 38 - (i % 3) * 6} height="7" rx="3.5" fill={i === 0 ? "#93B4F8" : "#E2E8F0"} />
          </g>
        ))}

        {/* KPI tiles */}
        {[["#2563EB", 54], ["#F97316", 40], ["#16A34A", 62]].map(([c, w], i) => (
          <g key={i}>
            <rect x={128 + i * 122} y="66" width="110" height="58" rx="10" fill="#FFFFFF" stroke="#E6E9EF" />
            <rect x={140 + i * 122} y="78" width="40" height="7" rx="3.5" fill="#CBD5E1" />
            <rect x={140 + i * 122} y="94" width={w as number} height="14" rx="4" fill={c as string} />
          </g>
        ))}

        {/* bookings chart */}
        <rect x="128" y="136" width="232" height="168" rx="10" fill="#FFFFFF" stroke="#E6E9EF" />
        <rect x="142" y="150" width="70" height="8" rx="4" fill="#CBD5E1" />
        {[0, 1, 2].map((i) => <line key={i} x1="142" x2="346" y1={194 + i * 30} y2={194 + i * 30} stroke="#F1F3F7" />)}
        {bars.map((h, i) => (
          <rect key={i} x={148 + i * 24} y={284 - h} width="14" height={h} rx="4" fill={i === bars.length - 1 ? "#F97316" : "#3B74F0"} opacity={0.55 + i * 0.06} />
        ))}

        {/* status donut */}
        <rect x="372" y="136" width="110" height="80" rx="10" fill="#FFFFFF" stroke="#E6E9EF" />
        <circle cx="404" cy="176" r="20" fill="none" stroke="#E2E8F0" strokeWidth="9" />
        <circle cx="404" cy="176" r="20" fill="none" stroke="#2563EB" strokeWidth="9" strokeDasharray="78 126" transform="rotate(-90 404 176)" />
        <circle cx="404" cy="176" r="20" fill="none" stroke="#F97316" strokeWidth="9" strokeDasharray="26 126" strokeDashoffset="-80" transform="rotate(-90 404 176)" />
        <rect x="434" y="164" width="36" height="7" rx="3.5" fill="#CBD5E1" />
        <rect x="434" y="180" width="26" height="7" rx="3.5" fill="#E2E8F0" />

        {/* map */}
        <rect x="372" y="226" width="110" height="78" rx="10" fill="#EAF2FF" />
        <path d="M372 270 C400 254 420 286 452 262 S482 252 482 252" stroke="#FFFFFF" strokeWidth="6" fill="none" />
        <path d="M410 226 L398 304" stroke="#FFFFFF" strokeWidth="4" />
        <path d="M436 248c0-8 6-14 14-14s14 6 14 14c0 11-14 24-14 24s-14-13-14-24z" fill="#F97316" />
        <circle cx="450" cy="248" r="5" fill="#FFFFFF" />
      </svg>

      <FloatCard icon={BadgeCheck} tone="bg-emerald-50 text-emerald-600" title="Technician approved" subtitle="ID & certificate verified"
        className="-left-2 top-[30%] xl:-left-8" />
      <FloatCard icon={Clock3} tone="bg-brand-50 text-brand-600" title="Live request" subtitle="04:32 left to respond"
        className="-right-2 -top-3 xl:-right-6" />
      <FloatCard icon={Wallet} tone="bg-orange-50 text-orange-600" title="Payment confirmed" subtitle="$25.00 · DEMO"
        className="-bottom-4 right-6" />
    </div>
  );
}
