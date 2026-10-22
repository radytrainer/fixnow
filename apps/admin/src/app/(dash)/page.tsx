"use client";

import type { BookingDto, Paginated } from "@fixnow/shared";
import {
  Activity, ArrowRight, ChartColumn, CircleDollarSign, ClipboardList, CreditCard, Hourglass, Percent, PieChart, Timer,
  TrendingUp, UserCheck, Wallet, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { AreaChart, BarChart, Donut, type Slice } from "@/components/charts";
import { CountdownBar } from "@/components/Countdown";
import { Card, DemoTag, EmptyState, ErrorBox, Loading, Meter, PageHeader, Stat, StatusBadge, fmtDate, usd } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useTr } from "@/lib/i18n";

interface Summary {
  users: Record<string, number>; technicians: Record<string, number>; bookingsByStatus: Record<string, number>;
  money: { gross: string; commission: string; net: string; paidCount: number; pendingAmount: string; pendingCount: number };
  payouts: Array<{ status: string; amount: string; count: number }>;
  daily: Array<{ day: string; bookings: number; gross: string }>;
  responses: { accepted: number; expired: number; declined: number; total: number };
  waitingRequests: Array<{ id: string; bookingCode: string; deadline: string; technicianName: string; serviceName: string }>;
  serverNow: string;
}

// Booking statuses grouped into 4 slices (categorical slots 1–4) so the donut stays readable.
const GROUPS: Array<{ label: string; color: string; statuses: string[] }> = [
  { label: "In progress", color: "var(--color-series-1)", statuses: ["REQUESTED", "ACCEPTED", "CONFIRMED", "FINISHED"] },
  { label: "Completed", color: "var(--color-series-3)", statuses: ["PAID", "RATED", "CLOSED"] },
  { label: "Expired / declined", color: "var(--color-series-4)", statuses: ["EXPIRED", "DECLINED"] },
  { label: "Cancelled / disputed", color: "var(--color-series-2)", statuses: ["CANCELLED", "CUSTOMER_NOT_AVAILABLE", "DISPUTED", "REFUNDED"] },
];

function AttentionCard({ href, icon: Icon, count, title, hint }: { href: string; icon: LucideIcon; count: number; title: string; hint: string }) {
  const tr = useTr();
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-[var(--radius-card)] border border-amber-200 bg-amber-50/60 p-3.5 transition hover:border-amber-300 hover:bg-amber-50">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink"><span className="tabular-nums">{count}</span> {tr(title)}</span>
        <span className="block truncate text-xs text-ink-3">{tr(hint)}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-amber-700 transition group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export default function Overview() {
  const tr = useTr();
  const { data: s, error, loading, reload } = useApi<Summary>("/admin/reports/summary", 5000);
  const recent = useApi<Paginated<BookingDto>>("/bookings?pageSize=6", 8000);

  if (loading && !s) return <div className="space-y-4"><div className="skeleton h-8 w-64" /><Loading rows={6} /></div>;
  if (error && !s) return <ErrorBox error={error} retry={() => reload()} />;
  if (!s) return null;

  const totalBookings = Object.values(s.bookingsByStatus).reduce((a, b) => a + b, 0);
  const pendingTechs = s.technicians.PENDING ?? 0;
  const techTotal = Object.values(s.technicians).reduce((a, b) => a + b, 0);
  const gross14 = s.daily.reduce((a, d) => a + Number(d.gross), 0);
  const bookings14 = s.daily.reduce((a, d) => a + d.bookings, 0);
  const payoutTotal = s.payouts.reduce((a, p) => a + Number(p.amount), 0);
  const payoutPaid = Number(s.payouts.find((p) => p.status === "PAID")?.amount ?? 0);
  const paidOrPending = s.money.paidCount + s.money.pendingCount;
  let running = 0;
  const cumulative = s.daily.map((d) => ({ x: d.day, y: Math.round((running += Number(d.gross)) * 100) / 100 }));
  const slices: Slice[] = GROUPS.map((g) => ({
    label: g.label, color: g.color, value: g.statuses.reduce((a, st) => a + (s.bookingsByStatus[st] ?? 0), 0),
  }));
  const attention = [
    pendingTechs > 0 && { href: "/technicians", icon: UserCheck, count: pendingTechs, title: pendingTechs === 1 ? "technician application" : "technician applications", hint: "Verify ID and certificates" },
    s.money.pendingCount > 0 && { href: "/payments", icon: CreditCard, count: s.money.pendingCount, title: s.money.pendingCount === 1 ? "payment to confirm" : "payments to confirm", hint: `${usd(s.money.pendingAmount)} awaiting confirmation` },
    s.waitingRequests.length > 0 && { href: "/monitor", icon: Timer, count: s.waitingRequests.length, title: s.waitingRequests.length === 1 ? "request waiting" : "requests waiting", hint: "Technician must respond within 5 minutes" },
  ].filter(Boolean) as Array<{ href: string; icon: LucideIcon; count: number; title: string; hint: string }>;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Business overview" sub="Sen Sok pilot · Phnom Penh Thmei & Tuek Thla · live, refreshes every 5s"
        actions={<DemoTag label="Payments are simulated (DEMO)" />} />

      {attention.length > 0 && (
        <section aria-label={tr("Needs attention")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {attention.map((a) => <AttentionCard key={a.href} {...a} />)}
        </section>
      )}

      <section aria-label={tr("Key figures")} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Gross paid" value={usd(s.money.gross)} icon={CircleDollarSign} sub={`${s.money.paidCount} ${tr("paid jobs")}`} />
        <Stat label="FixNow commission" value={usd(s.money.commission)} icon={Percent} iconTone="green" tone="good" sub="Revenue before gateway fees" />
        <Stat label="Technician net" value={usd(s.money.net)} icon={Wallet} iconTone="violet" sub="Owed / paid to providers" />
        <Stat label="Awaiting payment" value={usd(s.money.pendingAmount)} icon={Hourglass} iconTone="orange" tone="warn" sub={`${s.money.pendingCount} ${tr("finished jobs")}`} />
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Revenue growth" subtitle="Cumulative gross paid · last 14 days · USD" icon={TrendingUp} className="xl:col-span-2">
          <AreaChart label="Cumulative gross paid" format={(v) => `$${Math.round(v)}`} data={cumulative}
            summary={<p className="text-2xl font-bold tabular-nums text-ink">{usd(gross14)} <span className="text-sm font-medium text-ink-3">{tr("in 14 days")}</span></p>} />
        </Card>
        <Card title="Bookings by status" subtitle={`${totalBookings} ${tr("bookings")}`} icon={PieChart}>
          <Donut slices={slices} centerLabel="bookings" />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Bookings per day" subtitle="Last 14 days" icon={ChartColumn} className="xl:col-span-2">
          <BarChart label="Bookings" data={s.daily.map((d) => ({ x: d.day, y: d.bookings }))}
            summary={<p className="text-2xl font-bold tabular-nums text-ink">{bookings14} <span className="text-sm font-medium text-ink-3">{tr("in 14 days")}</span></p>} />
        </Card>
        <Card title="Operations health" subtitle="All time" icon={Activity}>
          <div className="space-y-5">
            <Meter label="Accept rate" value={s.responses.accepted} max={s.responses.total} tone="green"
              hint={`${s.responses.accepted} / ${s.responses.total} · ${s.responses.expired} ${tr("expired")} · ${s.responses.declined} ${tr("declined")}`} />
            <Meter label="Payment completion" value={s.money.paidCount} max={paidOrPending}
              hint={`${s.money.paidCount} / ${paidOrPending} ${tr("finished jobs paid")}`} />
            <Meter label="Payouts sent" value={payoutPaid} max={payoutTotal} tone="orange" display={`${usd(payoutPaid)} / ${usd(payoutTotal)}`} />
            <Meter label="Technicians approved" value={s.technicians.APPROVED ?? 0} max={techTotal}
              display={`${s.technicians.APPROVED ?? 0} / ${techTotal}`} hint={`${s.users.CUSTOMER ?? 0} ${tr("customers")}`} />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Live requests" subtitle="5-minute response window" icon={Timer}>
          {s.waitingRequests.length === 0
            ? <EmptyState icon={Timer} title="No requests are waiting for a technician response." />
            : (
              <ul className="space-y-4">
                {s.waitingRequests.map((w) => (
                  <li key={w.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-semibold text-ink">{w.bookingCode} · {w.serviceName}</span>
                    </div>
                    <p className="mb-1 text-xs text-ink-3">→ {w.technicianName}</p>
                    <CountdownBar deadline={w.deadline} serverNow={s.serverNow} />
                  </li>
                ))}
              </ul>
            )}
        </Card>
        <Card title="Recent bookings" icon={ClipboardList} className="xl:col-span-2" padded={false}
          actions={<Link href="/bookings" className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">{tr("View all")} <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>}>
          {recent.data?.items.length === 0 && <EmptyState title="No bookings yet" />}
          <ul className="divide-y divide-line-soft">
            {recent.data?.items.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-ink-3"><ClipboardList className="h-4 w-4" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{b.service.nameEn}</p>
                  <p className="truncate text-xs text-ink-3"><span className="font-mono">{b.bookingCode}</span> · {b.customer?.name ?? "—"} → {b.technician.name}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={b.status} />
                  <span className="text-[11px] tabular-nums text-ink-3">{b.payment ? usd(b.payment.amount) : fmtDate(b.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
