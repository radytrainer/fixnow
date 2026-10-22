"use client";

import { useState } from "react";
import { AreaChart } from "@/components/charts";
import { Download, TrendingUp } from "lucide-react";
import { Alert, Button, Card, DemoTag, ErrorBox, KV, Loading, PageHeader, Stat, usd } from "@/components/ui";
import { download, useApi } from "@/lib/api";

interface Summary {
  users: Record<string, number>; technicians: Record<string, number>; bookingsByStatus: Record<string, number>;
  money: { gross: string; commission: string; net: string; paidCount: number; pendingAmount: string; pendingCount: number };
  payouts: Array<{ status: string; amount: string; count: number }>;
  daily: Array<{ day: string; bookings: number; gross: string }>;
}

export default function ReportsPage() {
  const { data: s, error, loading, reload } = useApi<Summary>("/admin/reports/summary");
  const [err, setErr] = useState<string | null>(null);
  if (loading && !s) return <Loading />;
  if (error && !s) return <ErrorBox error={error} retry={() => reload()} />;
  if (!s) return null;
  const exportCsv = async (path: string, name: string) => {
    setErr(null);
    try { await download(path, name); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      <PageHeader title="Reports" sub="Totals across all time. Money figures come from simulated (DEMO) payments."
        actions={<>
          <Button variant="outline" icon={Download} onClick={() => exportCsv("/admin/reports/bookings.csv", "fixnow-bookings.csv")}>Bookings CSV</Button>
          <Button variant="outline" icon={Download} onClick={() => exportCsv("/admin/reports/payments.csv", "fixnow-payments.csv")}>Payments CSV</Button>
        </>} />
      {err && <div className="mb-4"><Alert tone="danger">{err}</Alert></div>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Users" value={Object.values(s.users).reduce((a, b) => a + b, 0)} sub={`${s.users.CUSTOMER ?? 0} customers · ${s.users.TECHNICIAN ?? 0} technicians`} />
        <Stat label="Gross paid" value={usd(s.money.gross)} sub={<DemoTag />} />
        <Stat label="Commission" value={usd(s.money.commission)} tone="good" />
        <Stat label="Provider net" value={usd(s.money.net)} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Gross paid per day (USD)" subtitle="Last 14 days" icon={TrendingUp} className="lg:col-span-2">
          <AreaChart label="Gross paid" format={(v) => `$${Math.round(v)}`} data={s.daily.map((d) => ({ x: d.day, y: Number(d.gross) }))} />
        </Card>
        <Card title="Bookings by status">
          {Object.entries(s.bookingsByStatus).sort((a, b) => b[1] - a[1]).map(([k, v]) => <KV key={k} k={k.replace(/_/g, " ").toLowerCase()} v={v} />)}
        </Card>
        <Card title="Technicians by status">
          {Object.entries(s.technicians).map(([k, v]) => <KV key={k} k={k.toLowerCase()} v={v} />)}
        </Card>
        <Card title="Payouts by status">
          {s.payouts.map((p) => <KV key={p.status} k={`${p.status.toLowerCase()} (${p.count})`} v={usd(p.amount)} />)}
        </Card>
        <Card title="Payments">
          <KV k="Paid jobs" v={s.money.paidCount} />
          <KV k="Awaiting confirmation" v={`${s.money.pendingCount} · ${usd(s.money.pendingAmount)}`} />
        </Card>
      </div>
    </>
  );
}
