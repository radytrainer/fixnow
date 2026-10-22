"use client";

import { useState } from "react";
import type { BookingDto, Paginated } from "@fixnow/shared";
import { Countdown } from "@/components/Countdown";
import { BookingDetail } from "@/components/BookingDetail";
import { Eye } from "lucide-react";
import { Button, Card, Drawer, ErrorBox, Filters, Loading, PageHeader, SearchInput, StatusBadge, Table, Td, fmtDate, usd } from "@/components/ui";
import { useApi } from "@/lib/api";

const STATUS_FILTERS: Array<[string, string]> = [
  ["", "All"], ["REQUESTED", "Requested"], ["ACCEPTED,CONFIRMED", "In progress"], ["FINISHED", "Awaiting payment"],
  ["PAID,RATED,CLOSED", "Paid"], ["EXPIRED,DECLINED", "Expired / declined"], ["CANCELLED,CUSTOMER_NOT_AVAILABLE", "Cancelled"], ["DISPUTED,REFUNDED", "Disputed / refunded"],
];

export default function BookingsPage() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  const list = useApi<Paginated<BookingDto>>(`/bookings?${params}`, 5000);
  const [open, setOpen] = useState<string | null>(null);
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Bookings" sub="Every booking across customers and technicians, live." />
      <Card title="All bookings" actions={<SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Code, customer or technician…" label="Search" />}>
        <div className="mb-4"><Filters value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUS_FILTERS} label="Booking status" /></div>
        {list.error && <ErrorBox error={list.error} retry={() => list.reload()} />}
        {list.loading && !list.data ? <Loading /> : (
          <Table head={["Code", "Service", "Customer", "Technician", "Status", "Amount", "Created", ""]} empty={list.data?.items.length === 0}>
            {list.data?.items.map((b) => (
              <tr key={b.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(b.id)}>
                <Td className="font-mono text-xs font-semibold">{b.bookingCode}</Td>
                <Td>{b.service.nameEn}</Td>
                <Td>{b.customer?.name ?? "—"}</Td>
                <Td>{b.technician.name}</Td>
                <Td><StatusBadge status={b.status} />{b.status === "REQUESTED" && <span className="ml-2"><Countdown deadline={b.responseDeadlineAt} serverNow={b.serverNow} /></span>}</Td>
                <Td>{b.payment ? usd(b.payment.amount) : "—"}</Td>
                <Td className="text-xs text-slate-500">{fmtDate(b.createdAt)}</Td>
                <Td><Button size="sm" variant="outline" icon={Eye} onClick={() => setOpen(b.id)}>Details</Button></Td>
              </tr>
            ))}
          </Table>
        )}
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>{list.data?.total ?? 0} bookings</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
            <span>Page {page} / {pages}</span>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      </Card>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={list.data?.items.find((b) => b.id === open)?.bookingCode ?? "Booking"}>
        {open && <BookingDetail id={open} onChanged={() => list.reload(true)} />}
      </Drawer>
    </>
  );
}
