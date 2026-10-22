"use client";

import { useState } from "react";
import { BookingDetail } from "@/components/BookingDetail";
import { Alert, Badge, Button, Card, Drawer, ErrorBox, Filters, Loading, PageHeader, Pager, StatusBadge, fmtDate } from "@/components/ui";
import { api, useApi } from "@/lib/api";

interface Ticket {
  id: string; ticketCode: string; category: string; description: string; status: string; createdBy: string; createdByRole: string;
  bookingId: string | null; bookingCode: string | null; bookingStatus: string | null; adminNote: string | null; assignedTo: string | null;
  createdAt: string; resolvedAt: string | null;
}

function TicketCard({ t, onChanged, openBooking }: { t: Ticket; onChanged: () => void; openBooking: (id: string) => void }) {
  const [note, setNote] = useState(t.adminNote ?? "");
  const [err, setErr] = useState<string | null>(null);
  const update = async (status?: string) => {
    setErr(null);
    try { await api(`/admin/support-tickets/${t.id}`, { method: "PATCH", body: { status, adminNote: note || undefined } }); onChanged(); }
    catch (e) { setErr((e as Error).message); }
  };
  return (
    <Card title={<span>{t.ticketCode} · {t.category}</span>} actions={<StatusBadge status={t.status} />}>
      <p className="text-sm text-slate-700">{t.description}</p>
      <p className="mt-2 text-xs text-slate-500">
        From {t.createdBy} <Badge>{t.createdByRole.toLowerCase()}</Badge> · {fmtDate(t.createdAt)}
        {t.bookingCode && <> · <button className="font-semibold text-blue-700 hover:underline" onClick={() => openBooking(t.bookingId!)}>{t.bookingCode}</button> ({t.bookingStatus})</>}
      </p>
      {err && <div className="mt-3"><Alert tone="danger">{err}</Alert></div>}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reply / internal note (visible to the user)" rows={2}
        className="mt-3 w-full rounded-lg border border-slate-300 p-2 text-sm" />
      <div className="mt-2 flex flex-wrap gap-2">
        {t.status === "OPEN" && <Button size="sm" variant="outline" onClick={() => update("IN_REVIEW")}>Start review</Button>}
        {t.status !== "RESOLVED" && t.status !== "CLOSED" && <Button size="sm" onClick={() => update("RESOLVED")}>Resolve</Button>}
        {t.status !== "CLOSED" && <Button size="sm" variant="ghost" onClick={() => update("CLOSED")}>Close</Button>}
        <Button size="sm" variant="ghost" onClick={() => update()}>Save note</Button>
      </div>
    </Card>
  );
}

export default function SupportPage() {
  const [status, setStatus] = useState<"" | "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED">("");
  const [page, setPage] = useState(1);
  const list = useApi<{ items: Ticket[]; total: number; pageSize: number }>(`/admin/support-tickets?page=${page}&pageSize=20${status ? `&status=${status}` : ""}`, 8000);
  const [booking, setBooking] = useState<string | null>(null);
  return (
    <>
      <PageHeader title="Support & disputes" sub="Tickets from customers and technicians. FixNow staff are the only channel — there is no customer–technician chat."
        actions={<Filters value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[["", "All"], ["OPEN", "Open"], ["IN_REVIEW", "In review"], ["RESOLVED", "Resolved"], ["CLOSED", "Closed"]]} />} />
      {list.error && <ErrorBox error={list.error} retry={() => list.reload()} />}
      {list.loading && !list.data && <Loading />}
      {list.data?.items.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No tickets.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {list.data?.items.map((t) => <TicketCard key={t.id} t={t} onChanged={() => list.reload(true)} openBooking={setBooking} />)}
      </div>
      {list.data && <Pager page={page} total={list.data.total} pageSize={list.data.pageSize} onPage={setPage} noun="tickets" />}
      <Drawer open={!!booking} onClose={() => setBooking(null)} title="Booking (dispute handling)">
        {booking && <BookingDetail id={booking} />}
      </Drawer>
    </>
  );
}
