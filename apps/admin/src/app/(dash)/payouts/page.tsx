"use client";

import { useState } from "react";
import { Alert, Button, Card, ErrorBox, Filters, Loading, PageHeader, Pager, Stat, StatusBadge, Table, Td, fmtDate, usd } from "@/components/ui";
import { api, useApi } from "@/lib/api";

interface Payout {
  id: string; technicianName: string; bookingCode: string; gross: string; commission: string; amount: string; status: string;
  method: string; reference: string | null; paidAt: string | null; createdAt: string;
}

export default function PayoutsPage() {
  const [status, setStatus] = useState<"" | "PENDING" | "PROCESSING" | "PAID" | "FAILED">("");
  const [page, setPage] = useState(1);
  const list = useApi<{ items: Payout[]; total: number; pageSize: number; totalsByStatus: Record<string, string> }>(
    `/admin/payouts?page=${page}&pageSize=20${status ? `&status=${status}` : ""}`, 8000);
  const [err, setErr] = useState<string | null>(null);

  const move = async (p: Payout, next: string) => {
    setErr(null);
    let reference: string | undefined;
    if (next === "PAID") {
      const r = window.prompt(`Bank transfer reference for ${p.technicianName} (${usd(p.amount)}):`, p.reference ?? "");
      if (!r) return;
      reference = r;
    }
    try { await api(`/admin/payouts/${p.id}`, { method: "PATCH", body: { status: next, reference } }); list.reload(true); }
    catch (e) { setErr((e as Error).message); }
  };
  const sum = (s: string[]) => s.reduce((a, k) => a + Number(list.data?.totalsByStatus?.[k] ?? 0), 0);

  return (
    <>
      <PageHeader title="Technician payouts" sub="Ledger of what each technician is owed. Transfers are made manually (e.g. weekly bank transfer) and recorded here." />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Owed (pending + processing)" value={usd(sum(["PENDING", "PROCESSING"]))} tone="warn" />
        <Stat label="Paid out" value={usd(sum(["PAID"]))} tone="good" />
        <Stat label="Failed / cancelled" value={usd(sum(["FAILED"]))} />
      </div>
      <div className="mb-4"><Alert tone="info">Record-only: FixNow does not move money from this screen. Each status change is audited.</Alert></div>
      {err && <div className="mb-4"><Alert tone="danger">{err}</Alert></div>}
      <Card actions={<Filters value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[["", "All"], ["PENDING", "Pending"], ["PROCESSING", "Processing"], ["PAID", "Paid"], ["FAILED", "Failed"]]} />}>
        {list.error && <ErrorBox error={list.error} retry={() => list.reload()} />}
        {list.loading && !list.data ? <Loading /> : (
          <Table head={["Technician", "Booking", "Gross", "Commission", "Payout", "Status", "Reference", ""]} empty={list.data?.items.length === 0}>
            {list.data?.items.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <Td className="font-semibold">{p.technicianName}</Td>
                <Td className="font-mono text-xs">{p.bookingCode}</Td>
                <Td>{usd(p.gross)}</Td>
                <Td>{usd(p.commission)}</Td>
                <Td className="font-semibold">{usd(p.amount)}</Td>
                <Td><StatusBadge status={p.status} /></Td>
                <Td className="text-xs text-slate-500">{p.reference ?? "—"}{p.paidAt ? ` · ${fmtDate(p.paidAt)}` : ""}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {p.status === "PENDING" && <Button size="sm" variant="outline" onClick={() => move(p, "PROCESSING")}>Processing</Button>}
                    {(p.status === "PENDING" || p.status === "PROCESSING") && <Button size="sm" onClick={() => move(p, "PAID")}>Mark paid</Button>}
                    {(p.status === "PENDING" || p.status === "PROCESSING") && <Button size="sm" variant="danger" onClick={() => move(p, "FAILED")}>Failed</Button>}
                    {p.status === "FAILED" && <Button size="sm" variant="outline" onClick={() => move(p, "PENDING")}>Retry</Button>}
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
        {list.data && <Pager page={page} total={list.data.total} pageSize={list.data.pageSize} onPage={setPage} noun="payouts" />}
      </Card>
    </>
  );
}
