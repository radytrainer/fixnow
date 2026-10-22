"use client";

import { useState } from "react";
import { Badge, Button, Card, ErrorBox, Filters, Loading, PageHeader, Table, Td, fmtDate } from "@/components/ui";
import { useApi } from "@/lib/api";

interface Log {
  id: string; actor: string | null; actorRole: string | null; action: string; entityType: string; entityId: string | null;
  before: unknown; after: unknown; createdAt: string;
}

export default function AuditPage() {
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const q = useApi<{ items: Log[]; total: number; pageSize: number }>(`/admin/audit-logs?page=${page}&pageSize=30${type ? `&entityType=${type}` : ""}`, 10000);
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;
  return (
    <>
      <PageHeader title="Audit log" sub="Who changed technician approval, payments, refunds, commission, payouts, services and tickets — and when." />
      <Card actions={<Filters value={type} onChange={(v) => { setType(v); setPage(1); }} options={[
        ["", "All"], ["technician_profile", "Technicians"], ["payment", "Payments"], ["payout", "Payouts"], ["app_setting", "Settings"],
        ["service", "Services"], ["booking", "Bookings"], ["support_ticket", "Support"], ["user", "Users"],
      ]} />}>
        {q.error && <ErrorBox error={q.error} retry={() => q.reload()} />}
        {q.loading && !q.data ? <Loading /> : (
          <Table head={["When", "Actor", "Action", "Entity", "Before → After"]} empty={q.data?.items.length === 0}>
            {q.data?.items.map((l) => (
              <tr key={l.id} className="align-top">
                <Td className="whitespace-nowrap text-xs text-slate-500">{fmtDate(l.createdAt)}</Td>
                <Td><p className="font-semibold">{l.actor ?? "system"}</p>{l.actorRole && <Badge>{l.actorRole.toLowerCase()}</Badge>}</Td>
                <Td className="font-mono text-xs font-semibold">{l.action}</Td>
                <Td className="text-xs">{l.entityType}<p className="font-mono text-[10px] text-slate-400">{l.entityId?.slice(0, 8)}</p></Td>
                <Td className="max-w-md font-mono text-[11px] text-slate-600">
                  <span className="text-red-700">{l.before ? JSON.stringify(l.before) : "∅"}</span> → <span className="text-green-700">{l.after ? JSON.stringify(l.after) : "∅"}</span>
                </Td>
              </tr>
            ))}
          </Table>
        )}
        <div className="mt-4 flex items-center justify-end gap-2 text-sm text-slate-500">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
          <span>Page {page} / {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </Card>
    </>
  );
}
