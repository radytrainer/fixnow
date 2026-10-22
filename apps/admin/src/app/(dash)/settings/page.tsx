"use client";

import { useEffect, useState } from "react";
import { splitCommission } from "@fixnow/shared";
import { Alert, Button, Card, ErrorBox, KV, Loading, PageHeader, fmtDate } from "@/components/ui";
import { api, useApi } from "@/lib/api";

interface Setting { key: string; value: unknown; updatedBy: string | null; updatedAt: string }

export default function SettingsPage() {
  const s = useApi<{ items: Setting[] }>("/admin/settings");
  const current = s.data?.items.find((x) => x.key === "commission_rate");
  const [rate, setRate] = useState("");
  const [sample, setSample] = useState("25.00");
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  useEffect(() => { if (current) setRate(String(current.value)); }, [current]);

  if (s.loading && !s.data) return <Loading />;
  if (s.error && !s.data) return <ErrorBox error={s.error} retry={() => s.reload()} />;

  let calc: ReturnType<typeof splitCommission> | null = null;
  try { calc = splitCommission(sample, rate || "0"); } catch { calc = null; }

  return (
    <>
      <PageHeader title="Commission & settings" sub="Commission is snapshotted onto each payment when the job is finished; changing it never alters past payments." />
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Commission rate">
          <p className="mb-3 text-sm text-slate-600">Default 15% per the business brief (assumption — pilot rate not yet decided). Allowed 0–50%.</p>
          <div className="flex items-center gap-2">
            <input aria-label="Commission rate percent" value={rate} onChange={(e) => setRate(e.target.value)} className="h-10 w-28 rounded-lg border border-slate-300 px-3 text-sm" />
            <span className="text-sm text-slate-500">%</span>
            <Button onClick={async () => {
              setMsg(null);
              try { await api("/admin/settings/commission_rate", { method: "PUT", body: { value: Number(rate) } }); s.reload(true); setMsg({ tone: "success", text: `Commission set to ${rate}%. Audited.` }); }
              catch (e) { setMsg({ tone: "danger", text: (e as Error).message }); }
            }}>Save</Button>
          </div>
          {current && <p className="mt-3 text-xs text-slate-500">Last changed {fmtDate(current.updatedAt)}{current.updatedBy ? ` by ${current.updatedBy}` : " (seed)"}</p>}
        </Card>
        <Card title="Commission calculator">
          <label className="text-sm">Job amount (USD)
            <input value={sample} onChange={(e) => setSample(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3" />
          </label>
          {calc ? (
            <div className="mt-3">
              <KV k="Gross" v={`$${calc.amount}`} />
              <KV k={`FixNow commission (${Number(calc.commissionRate)}%)`} v={`$${calc.commissionAmount}`} />
              <KV k="Technician net (before gateway fees)" v={<span className="text-green-700">${calc.technicianNet}</span>} />
            </div>
          ) : <p className="mt-3 text-sm text-red-700">Enter a valid amount and rate.</p>}
          <p className="mt-2 text-xs text-slate-500">Decimal-safe: computed in integer cents, commission rounded half-up.</p>
        </Card>
        <Card title="Application settings" className="lg:col-span-2">
          {s.data!.items.map((x) => <KV key={x.key} k={x.key} v={`${JSON.stringify(x.value)} · ${fmtDate(x.updatedAt)}`} />)}
          <p className="mt-3 text-xs text-slate-500">Booking response window (300 s) and warranty window (3 days) are fixed in code for the competition build and shown here for reference.</p>
        </Card>
      </div>
    </>
  );
}
