"use client";

import { useState } from "react";
import type { BookingDto, Paginated } from "@fixnow/shared";
import { Countdown } from "@/components/Countdown";
import { Card, Drawer, ErrorBox, Loading, PageHeader, Stat, StatusBadge, Table, Td, fmtDate } from "@/components/ui";
import { useApi } from "@/lib/api";
import { BookingDetail } from "@/components/BookingDetail";

function List({ status, title, onOpen, showDeadline }: { status: string; title: string; onOpen: (id: string) => void; showDeadline?: boolean }) {
  const q = useApi<Paginated<BookingDto>>(`/bookings?status=${status}&pageSize=50`, 3000);
  return (
    <Card title={`${title} (${q.data?.total ?? 0})`}>
      {q.error && <ErrorBox error={q.error} />}
      {q.loading && !q.data ? <Loading /> : (
        <Table head={["Code", "Service", "Technician", "Status", showDeadline ? "Time left" : "Created", showDeadline ? "Deadline" : "Reason"]} empty={q.data?.items.length === 0}>
          {q.data?.items.map((b) => (
            <tr key={b.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpen(b.id)}>
              <Td className="font-mono text-xs font-semibold">{b.bookingCode}</Td>
              <Td>{b.service.nameEn}</Td>
              <Td>{b.technician.name}</Td>
              <Td><StatusBadge status={b.status} /></Td>
              <Td>{showDeadline ? <Countdown deadline={b.responseDeadlineAt} serverNow={b.serverNow} /> : <span className="text-xs text-slate-500">{fmtDate(b.createdAt)}</span>}</Td>
              <Td className="text-xs text-slate-500">{showDeadline ? fmtDate(b.responseDeadlineAt) : b.cancelReason ?? "—"}</Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

export default function MonitorPage() {
  const [open, setOpen] = useState<string | null>(null);
  const s = useApi<{ responses: { accepted: number; expired: number; declined: number; total: number } }>("/admin/reports/summary", 5000);
  const r = s.data?.responses;
  return (
    <>
      <PageHeader title="Timeouts & cancellations" sub="Requests expire server-side 5 minutes after creation if the technician does not respond." />
      {r && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Responded requests" value={r.total} />
          <Stat label="Accepted" value={r.accepted} tone="good" />
          <Stat label="Expired (no response)" value={r.expired} tone="warn" />
          <Stat label="Declined" value={r.declined} />
        </div>
      )}
      <div className="space-y-5">
        <List status="REQUESTED" title="Waiting for technician" onOpen={setOpen} showDeadline />
        <List status="EXPIRED,DECLINED" title="Expired & declined" onOpen={setOpen} />
        <List status="CANCELLED,CUSTOMER_NOT_AVAILABLE" title="Cancelled & customer not available" onOpen={setOpen} />
      </div>
      <Drawer open={!!open} onClose={() => setOpen(null)} title="Booking">
        {open && <BookingDetail id={open} />}
      </Drawer>
    </>
  );
}
