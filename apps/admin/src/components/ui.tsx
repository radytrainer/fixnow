"use client";

import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Info, Inbox, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTr } from "@/lib/i18n";

/* ---------------------------------------------------------------- badges */

type Tone = "info" | "success" | "warning" | "danger" | "neutral" | "accent" | "demo";

export const STATUS_TONE: Record<string, Tone> = {
  REQUESTED: "warning", ACCEPTED: "info", CONFIRMED: "info", FINISHED: "accent", PAID: "success", RATED: "success",
  CLOSED: "neutral", DECLINED: "neutral", EXPIRED: "neutral", CANCELLED: "neutral", CUSTOMER_NOT_AVAILABLE: "neutral",
  DISPUTED: "danger", REFUNDED: "danger", PENDING: "warning", APPROVED: "success", REJECTED: "danger", SUSPENDED: "danger",
  PROCESSING: "info", FAILED: "danger", OPEN: "warning", IN_REVIEW: "info", RESOLVED: "success", ACTIVE: "success",
  COMING_SOON: "neutral",
};

const toneClass: Record<Tone, string> = {
  info: "bg-blue-50 text-blue-700 ring-blue-600/15",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  warning: "bg-amber-50 text-amber-800 ring-amber-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/15",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/15",
  accent: "bg-orange-50 text-orange-700 ring-orange-600/15",
  demo: "bg-orange-100 text-orange-800 ring-orange-600/25",
};
const dotClass: Record<Tone, string> = {
  info: "bg-blue-500", success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-red-500",
  neutral: "bg-slate-400", accent: "bg-orange-500", demo: "bg-orange-500",
};

export function Badge({ children, tone = "neutral", dot }: { children: ReactNode; tone?: Tone; dot?: boolean }) {
  const tr = useTr();
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${toneClass[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotClass[tone]}`} aria-hidden />}
      {tr(children)}
    </span>
  );
}

/** Status is always shown as dot + text, never color alone. */
export function StatusBadge({ status }: { status: string }) {
  const tr = useTr();
  const label = status.replace(/_/g, " ");
  const pretty = label.charAt(0) + label.slice(1).toLowerCase();
  const translated = tr(label);
  return <Badge dot tone={STATUS_TONE[status] ?? "neutral"}>{translated === label ? pretty : translated}</Badge>;
}

export function DemoTag({ label = "DEMO" }: { label?: string }) {
  return <Badge tone="demo">{label}</Badge>;
}

/* ---------------------------------------------------------------- layout */

export function Card({ title, subtitle, actions, children, className = "", padded = true, icon: Icon }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean; icon?: LucideIcon;
}) {
  const tr = useTr();
  return (
    <section className={`rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line-soft px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-ink">{tr(title)}</h2>
              {subtitle && <p className="truncate text-xs text-ink-3">{tr(subtitle)}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? "p-4 sm:p-5" : ""}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  const tr = useTr();
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{tr(title)}</h1>
        {sub && <p className="mt-1 max-w-3xl text-sm text-ink-3">{tr(sub)}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- controls */

export function Button({ children, onClick, variant = "primary", disabled, size = "md", type = "button", title, icon: Icon }: {
  children?: ReactNode; onClick?: () => unknown | Promise<unknown>; variant?: "primary" | "secondary" | "outline" | "danger" | "ghost" | "accent";
  disabled?: boolean; size?: "sm" | "md"; type?: "button" | "submit"; title?: string; icon?: LucideIcon;
}) {
  const [busy, setBusy] = useState(false);
  const tr = useTr();
  const v = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 border-transparent shadow-sm",
    secondary: "bg-violet-600 text-white hover:bg-violet-700 border-transparent shadow-sm",
    accent: "bg-orange-500 text-white hover:bg-orange-600 border-transparent shadow-sm",
    outline: "bg-surface text-ink hover:bg-slate-50 border-line shadow-sm",
    danger: "bg-surface text-red-700 hover:bg-red-50 border-red-200",
    ghost: "bg-transparent text-brand-700 hover:bg-brand-50 border-transparent",
  }[variant];
  return (
    <button
      type={type} title={title} aria-label={children === undefined ? title : undefined}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={async () => { if (!onClick) return; setBusy(true); try { await onClick(); } finally { setBusy(false); } }}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${size === "sm" ? "h-8 px-2.5 text-xs" : "h-10 px-4 text-sm"} ${v}`}
    >
      {busy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
        : Icon && <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />}
      {children !== undefined && tr(children)}
    </button>
  );
}

/** Segmented filter; scrolls horizontally on small screens instead of wrapping into many rows. */
export function Filters<T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label?: string }) {
  const tr = useTr();
  return (
    <div className="scroll-thin -mx-1 max-w-full overflow-x-auto px-1" role="group" aria-label={label}>
      <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
        {options.map(([v, l]) => (
          <button key={v} onClick={() => onChange(v)} aria-pressed={value === v}
            className={`h-7 whitespace-nowrap rounded-md px-2.5 text-xs font-semibold transition ${value === v ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"}`}>
            {tr(l)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  const tr = useTr();
  return (
    <label className="relative block w-full sm:w-64">
      <span className="sr-only">{tr(label)}</span>
      <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={tr(placeholder)}
        className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-sm outline-none transition placeholder:text-ink-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
    </label>
  );
}

/* ---------------------------------------------------------------- data display */

export function Stat({ label, value, sub, tone, icon: Icon, iconTone = "brand" }: {
  label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "warn"; icon?: LucideIcon;
  iconTone?: "brand" | "green" | "orange" | "violet" | "slate";
}) {
  const tr = useTr();
  const iconBg = { brand: "bg-brand-50 text-brand-600", green: "bg-emerald-50 text-emerald-600", orange: "bg-orange-50 text-orange-600", violet: "bg-violet-50 text-violet-600", slate: "bg-slate-100 text-slate-600" }[iconTone];
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-ink-3 sm:text-[13px]">{tr(label)}</p>
        {Icon && <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}><Icon className="h-4 w-4" aria-hidden /></span>}
      </div>
      <p className={`mt-1 text-xl font-bold tracking-tight tabular-nums sm:text-2xl ${tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-orange-600" : "text-ink"}`}>{value}</p>
      {sub && <div className="mt-1 text-xs text-ink-3">{tr(sub)}</div>}
    </div>
  );
}

/** Labelled progress meter: the value is always shown as text, never color alone. */
export function Meter({ label, value, max, display, hint, tone = "brand" }: {
  label: string; value: number; max: number; display?: string; hint?: ReactNode; tone?: "brand" | "green" | "orange" | "red";
}) {
  const tr = useTr();
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const bar = { brand: "bg-brand-600", green: "bg-emerald-500", orange: "bg-orange-500", red: "bg-red-500" }[tone];
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink-2">{tr(label)}</span>
        <span className="text-sm font-semibold tabular-nums text-ink">{display ?? `${Math.round(pct)}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={tr(label)} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-[width] duration-500 ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      {hint && <p className="mt-1 text-xs text-ink-3">{tr(hint)}</p>}
    </div>
  );
}

/** Table that collapses into labelled cards below 768px (labels stamped onto cells from the headers). */
export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  const tr = useTr();
  const ref = useRef<HTMLTableElement>(null);
  const labels = head.map((h) => (typeof h === "string" ? tr(h) : ""));
  useLayoutEffect(() => {
    ref.current?.querySelectorAll("tbody tr").forEach((row) => {
      row.querySelectorAll(":scope > td").forEach((cell, i) => cell.setAttribute("data-label", labels[i] ?? ""));
    });
  });
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-0">
      <table ref={ref} className="rtable w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            {head.map((h, i) => <th key={i} scope="col" className="whitespace-nowrap px-5 pb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{tr(h)}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">{children}</tbody>
      </table>
      {empty && <EmptyState title="No records match this filter." />}
    </div>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-5 py-3 align-middle ${className}`}>{children}</td>;
}

export function KV({ k, v }: { k: ReactNode; v: ReactNode }) {
  const tr = useTr();
  return (
    <div className="flex justify-between gap-4 border-b border-line-soft py-2.5 text-sm last:border-0">
      <span className="text-ink-3">{tr(k)}</span>
      <span className="text-right font-medium text-ink">{v}</span>
    </div>
  );
}

/** Prev/next pager for paginated API lists ({ total, pageSize }). */
export function Pager({ page, total, pageSize, onPage, noun = "records" }: { page: number; total: number; pageSize: number; onPage: (p: number) => void; noun?: string }) {
  const tr = useTr();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  return (
    <nav className="mt-4 flex items-center justify-between gap-2 border-t border-line-soft pt-4 text-sm text-ink-3" aria-label="Pagination">
      <span className="tabular-nums">{from}–{Math.min(total, page * pageSize)} / {total} {tr(noun)}</span>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)} title="Previous page" />
        <span className="min-w-12 text-center tabular-nums">{page} / {pages}</span>
        <Button size="sm" variant="outline" icon={ChevronRight} disabled={page >= pages} onClick={() => onPage(page + 1)} title="Next page" />
      </div>
    </nav>
  );
}

/* ---------------------------------------------------------------- overlays */

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  const tr = useTr();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
      <button aria-label="Close panel" className="anim-fade absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <aside className="anim-drawer relative z-10 flex h-full w-full max-w-xl flex-col bg-surface shadow-[var(--shadow-pop)]">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-6">
          <h2 className="truncate text-base font-semibold text-ink">{tr(title)}</h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-3 hover:bg-slate-100 hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        <div className="scroll-thin flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
      </aside>
    </div>
  );
}

/* ---------------------------------------------------------------- feedback */

export function Alert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "danger" | "warning" | "success" }) {
  const c = {
    info: ["bg-blue-50 text-blue-900 border-blue-200", Info, "text-blue-600"],
    danger: ["bg-red-50 text-red-900 border-red-200", AlertCircle, "text-red-600"],
    warning: ["bg-amber-50 text-amber-900 border-amber-200", TriangleAlert, "text-amber-600"],
    success: ["bg-emerald-50 text-emerald-900 border-emerald-200", CheckCircle2, "text-emerald-600"],
  } as const;
  const [cls, Icon, iconCls] = c[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${cls}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconCls}`} aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Loading({ rows = 4 }: { rows?: number }) {
  const tr = useTr();
  return (
    <div className="space-y-3 py-2" aria-busy="true" aria-label={tr("Loading…")}>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton h-10" />)}
    </div>
  );
}

export function EmptyState({ title, hint, icon: Icon = Inbox }: { title: string; hint?: string; icon?: LucideIcon }) {
  const tr = useTr();
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-ink-3"><Icon className="h-5 w-5" aria-hidden /></span>
      <p className="text-sm font-medium text-ink-2">{tr(title)}</p>
      {hint && <p className="mt-1 text-xs text-ink-3">{tr(hint)}</p>}
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <Alert tone="danger">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{error.message}</span>
        {retry && <Button size="sm" variant="outline" onClick={retry}>Retry</Button>}
      </div>
    </Alert>
  );
}

/* ---------------------------------------------------------------- formatting */

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Phnom_Penh" }) : "—";

export const usd = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "—" : `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
