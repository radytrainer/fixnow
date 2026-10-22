"use client";

import { CircleCheck, Undo2 } from "lucide-react";
import { useState } from "react";
import { Alert, Button, Card, DemoTag, ErrorBox, Filters, Loading, PageHeader, Pager, StatusBadge, Table, Td, fmtDate, usd } from "@/components/ui";
import { api, useApi } from "@/lib/api";

interface Payment {
  id: string; bookingId: string; bookingCode: string; bookingStatus: string; serviceName: string; customerName: string; technicianName: string;
  amount: string; currency: string; status: string; commissionRate: string; commissionAmount: string; technicianNet: string; isDemo: boolean;
  provider: string; qrPayload: string; confirmedBy: string | null; confirmedAt: string | null; refundedAt: string | null; refundReason: string | null;
  payoutStatus: string | null; createdAt: string;
}

export default function PaymentsPage() {
  const [status, setStatus] = useState<"" | "PENDING" | "PAID" | "REFUNDED">("");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const list = useApi<{ items: Payment[]; total: number; pageSize: number }>(
    `/admin/payments?page=${page}&pageSize=20${status ? `&status=${status}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`, 4000);
  const [msg, setMsg] = useState<{ tone: "danger" | "success"; text: string } | null>(null);

  const confirm = async (p: Payment) => {
    setMsg(null);
    try {
      await api(`/admin/payments/${p.id}/confirm-demo`, { method: "POST" });
      setMsg({ tone: "success", text: `${p.bookingCode}: simulated payment of ${usd(p.amount)} confirmed and audited. Payout record created.` });
      list.reload(true);
    } catch (e) { setMsg({ tone: "danger", text: (e as Error).message }); }
  };
  const refund = async (p: Payment) => {
    const reason = window.prompt(`Refund ${p.bookingCode} (${usd(p.amount)}). Reason:`);
    if (!reason) return;
    try { await api(`/admin/payments/${p.id}/refund`, { method: "POST", body: { reason } }); list.reload(true); setMsg({ tone: "success", text: `${p.bookingCode} refunded (record only).` }); }
    catch (e) { setMsg({ tone: "danger", text: (e as Error).message }); }
  };

  return (
    <>
      <PageHeader title="Payments" sub="Booking-linked QR payments. No payment gateway is connected: confirmation is a protected, audited admin action."
        actions={<DemoTag label="DEMO – simulated KHQR" />} />
      <div className="mb-4">
        <Alert tone="warning">
          Payments here are <b>simulated</b>. No real money is collected, held or moved. A real KHQR provider requires credentials, verified callbacks and licensing review.
        </Alert>
      </div>
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <Card actions={<>
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="FN-…" aria-label="Booking code" className="h-8 w-28 rounded-lg border border-slate-300 px-2 text-xs" />
        <Filters value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[["", "All"], ["PENDING", "Awaiting confirmation"], ["PAID", "Paid"], ["REFUNDED", "Refunded"]]} />
      </>}>
        {list.error && <ErrorBox error={list.error} retry={() => list.reload()} />}
        {list.loading && !list.data ? <Loading /> : (
          <Table head={["Booking", "Customer → Technician", "Gross", "Commission", "Tech net", "Status", "Confirmed", ""]} empty={list.data?.items.length === 0}>
            {list.data?.items.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <Td><p className="font-mono text-xs font-semibold">{p.bookingCode}</p><p className="text-xs text-slate-500">{p.serviceName}</p></Td>
                <Td className="text-xs">{p.customerName} → {p.technicianName}</Td>
                <Td className="font-semibold">{usd(p.amount)}</Td>
                <Td>{usd(p.commissionAmount)} <span className="text-xs text-slate-500">({Number(p.commissionRate)}%)</span></Td>
                <Td>{usd(p.technicianNet)}</Td>
                <Td><div className="flex flex-wrap gap-1"><StatusBadge status={p.status} />{p.isDemo && <DemoTag />}</div></Td>
                <Td className="text-xs text-slate-500">{p.confirmedAt ? `${fmtDate(p.confirmedAt)} · ${p.confirmedBy}` : "—"}</Td>
                <Td>
                  {p.status === "PENDING" && <Button size="sm" variant="accent" icon={CircleCheck} onClick={() => confirm(p)} disabled={p.bookingStatus !== "FINISHED"}>Confirm (demo)</Button>}
                  {p.status === "PAID" && <Button size="sm" variant="danger" icon={Undo2} onClick={() => refund(p)}>Refund</Button>}
                  {p.status === "REFUNDED" && <span className="text-xs text-slate-500">{p.refundReason}</span>}
                </Td>
              </tr>
            ))}
          </Table>
        )}
        {list.data && <Pager page={page} total={list.data.total} pageSize={list.data.pageSize} onPage={setPage} noun="payments" />}
      </Card>
    </>
  );
}
