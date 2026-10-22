"use client";

import {
  ChartColumn, ClipboardList, CreditCard, House, Landmark, LayoutDashboard, LifeBuoy, LogOut, Menu, PanelLeftClose,
  PanelLeftOpen, ScrollText, Settings, ShieldCheck, Tags, Timer, UserCheck, Users, X, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, getToken, setSession, useApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { DemoTag } from "./ui";

interface NavItem { href: string; label: string; icon: LucideIcon; badge?: "pendingTechs" | "pendingPayments" | "waiting" }
const NAV: Array<{ group: string; items: NavItem[] }> = [
  { group: "Overview", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    group: "Operations", items: [
      { href: "/technicians", label: "Technician approvals", icon: UserCheck, badge: "pendingTechs" },
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/bookings", label: "Bookings", icon: ClipboardList },
      { href: "/monitor", label: "Timeouts & cancellations", icon: Timer, badge: "waiting" },
      { href: "/services", label: "Services & pricing", icon: Tags },
    ],
  },
  {
    group: "Money", items: [
      { href: "/payments", label: "Payments", icon: CreditCard, badge: "pendingPayments" },
      { href: "/payouts", label: "Technician payouts", icon: Landmark },
      { href: "/settings", label: "Commission & settings", icon: Settings },
    ],
  },
  {
    group: "Care", items: [
      { href: "/support", label: "Support & disputes", icon: LifeBuoy },
      { href: "/warranty", label: "Warranty", icon: ShieldCheck },
    ],
  },
  {
    group: "Insights", items: [
      { href: "/reports", label: "Reports & CSV", icon: ChartColumn },
      { href: "/audit", label: "Audit log", icon: ScrollText },
    ],
  },
];

interface Me { id: string; name: string | null; role: string; phone: string }
interface Counts { technicians: Record<string, number>; money: { pendingCount: number }; waitingRequests: unknown[] }
const COLLAPSE_KEY = "fixnow.admin.sidebarCollapsed";

function Logo({ compact }: { compact?: boolean }) {
  const { tr } = useI18n();
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="FixNow admin home">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 text-white shadow-sm">
        <House className="h-[18px] w-[18px]" aria-hidden />
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block text-[17px] font-extrabold tracking-tight text-ink">Fix<span className="text-orange-500">Now</span></span>
          <span className="block truncate text-[11px] font-medium text-ink-3">{tr("Admin console")}</span>
        </span>
      )}
    </Link>
  );
}

function SidebarNav({ collapsed, counts, onNavigate }: { collapsed: boolean; counts: Counts | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { tr } = useI18n();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const badgeValue = (b?: NavItem["badge"]) => {
    if (!b || !counts) return 0;
    if (b === "pendingTechs") return counts.technicians.PENDING ?? 0;
    if (b === "pendingPayments") return counts.money.pendingCount;
    return counts.waitingRequests.length;
  };
  return (
    <nav className={`scroll-thin flex-1 px-3 pb-4 ${collapsed ? "overflow-visible" : "overflow-y-auto"}`} aria-label="Main">
      {NAV.map((g) => (
        <div key={g.group} className="mt-5 first:mt-2">
          {collapsed ? <div className="mx-2 mb-2 h-px bg-line" aria-hidden />
            : <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{tr(g.group)}</p>}
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const active = isActive(i.href);
              const count = badgeValue(i.badge);
              return (
                <li key={i.href} className="group relative">
                  <Link
                    href={i.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? `${tr(i.label)}${count ? ` (${count})` : ""}` : undefined}
                    className={`flex h-9 items-center gap-3 rounded-lg text-sm font-medium transition-colors ${collapsed ? "justify-center px-0" : "px-2.5"} ${
                      active ? "bg-brand-50 text-brand-700" : "text-ink-2 hover:bg-slate-100 hover:text-ink"}`}
                  >
                    <span className="relative">
                      <i.icon className={`h-[18px] w-[18px] ${active ? "text-brand-600" : "text-ink-3 group-hover:text-ink-2"}`} aria-hidden />
                      {collapsed && count > 0 && <span className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-orange-500" aria-hidden />}
                    </span>
                    {!collapsed && <span className="flex-1 truncate">{tr(i.label)}</span>}
                    {!collapsed && count > 0 && (
                      <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-orange-700">{count}</span>
                    )}
                  </Link>
                  {collapsed && (
                    <span role="tooltip" className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      {tr(i.label)}{count ? ` · ${count}` : ""}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserMenu({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const { tr } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const initials = (me.name ?? "Admin").replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu"
        className="flex h-10 items-center gap-2.5 rounded-lg pl-1 pr-2 hover:bg-slate-100">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{initials}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-40 truncate text-sm font-semibold text-ink">{me.name}</span>
          <span className="block text-[11px] text-ink-3">{tr("Administrator")}</span>
        </span>
      </button>
      {open && (
        <div role="menu" className="anim-fade absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)]">
          <div className="border-b border-line-soft px-3.5 py-3">
            <p className="truncate text-sm font-semibold text-ink">{me.name}</p>
            <p className="text-xs text-ink-3">{me.phone}</p>
          </div>
          <button role="menuitem" onClick={onSignOut} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-700 hover:bg-red-50">
            <LogOut className="h-4 w-4" aria-hidden /> {tr("Sign out")}
          </button>
        </div>
      )}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, tr } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const counts = useApi<Counts>(me ? "/admin/reports/summary" : null, 15000);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch { /* storage blocked */ }
  }, []);
  const toggleCollapsed = () => setCollapsed((c) => {
    try { localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1"); } catch { /* storage blocked */ }
    return !c;
  });

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    api<Me>("/me").then((m) => {
      if (m.role !== "ADMIN") { setSession(null); router.replace("/login"); return; }
      setMe(m);
    }).catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [mobileOpen]);

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-ink-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-r-transparent" aria-hidden />
        {tr("Checking admin session…")}
      </div>
    );
  }

  const signOut = () => { setSession(null); router.replace("/login"); };
  const current = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })))
    .find((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)));
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar: full width or icon rail (remembered per browser) */}
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex ${collapsed ? "w-[72px]" : "w-64"}`}>
        <div className={`flex h-16 items-center ${collapsed ? "justify-center" : "px-5"}`}><Logo compact={collapsed} /></div>
        <SidebarNav collapsed={collapsed} counts={counts.data} />
        <div className="border-t border-line p-3">
          <button onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}
            className={`flex h-9 w-full items-center gap-3 rounded-lg text-sm font-medium text-ink-3 hover:bg-slate-100 hover:text-ink ${collapsed ? "justify-center" : "px-2.5"}`}>
            <CollapseIcon className="h-[18px] w-[18px]" aria-hidden />
            {!collapsed && <span>{tr("Collapse")}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile / tablet drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button aria-label="Close menu" className="anim-fade absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="anim-drawer-left relative flex h-full w-[min(18rem,85vw)] flex-col bg-surface shadow-[var(--shadow-pop)]">
            <div className="flex h-16 items-center justify-between px-4">
              <Logo />
              <button onClick={() => setMobileOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-3 hover:bg-slate-100" aria-label="Close menu">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <SidebarNav collapsed={false} counts={counts.data} onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-line p-4"><DemoTag label={tr("DEMO MODE · simulated payments")} /></div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur sm:gap-3 sm:px-6">
          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-2 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <button className="hidden h-9 w-9 items-center justify-center rounded-lg text-ink-3 hover:bg-slate-100 hover:text-ink lg:flex" onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? tr("Expand") : tr("Collapse")}>
            <CollapseIcon className="h-[18px] w-[18px]" aria-hidden />
          </button>
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex items-center gap-1.5 truncate text-sm">
              <li className="hidden text-ink-3 sm:block">{tr(current?.group ?? "")}</li>
              <li className="hidden text-ink-3 sm:block" aria-hidden>/</li>
              <li className="truncate font-semibold text-ink" aria-current="page">{tr(current?.label ?? "")}</li>
            </ol>
          </nav>
          <span className="hidden xl:inline"><DemoTag label={tr("DEMO MODE · simulated payments")} /></span>
          <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold" role="group" aria-label="Language">
            {(["en", "km"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
                className={`h-7 rounded-md px-2 sm:px-2.5 ${lang === l ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"}`}>
                {l === "en" ? "EN" : "ខ្មែរ"}
              </button>
            ))}
          </div>
          <UserMenu me={me} onSignOut={signOut} />
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-6 sm:py-7">{children}</main>
      </div>
    </div>
  );
}
