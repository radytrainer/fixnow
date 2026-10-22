"use client";

import { useState } from "react";
import { Alert, Button, Card, ErrorBox, Loading, PageHeader, StatusBadge, Table, Td, fmtDate } from "@/components/ui";
import { api, fileUrl, useApi } from "@/lib/api";

interface Warranty {
  id: string; bookingCode: string; status: string; description: string; resolutionNote: string | null; createdAt: string;
  resolvedAt: string | null; serviceNameEn: string; customerName: string; technicianName: string; mediaUrls: string[];
}

export default function WarrantyPage() {
  const list = useApi<{ items: Warranty[] }>("/warranty", 10000);
  const [err, setErr] = useState<string | null>(null);
  const act = async (id: string, action: string) => {
    setErr(null);
    const note = action === "accept" ? undefined : window.prompt("Note (optional):") ?? undefined;
    try { await api(`/warranty/${id}/${action}`, { method: "POST", body: { note } }); list.reload(true); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      <PageHeader title="Warranty" sub="3-day re-service window after payment (proposal decision). Requests route to the technician who did the job." />
      {err && <div className="mb-4"><Alert tone="danger">{err}</Alert></div>}
      <Card>
        {list.error && <ErrorBox error={list.error} retry={() => list.reload()} />}
        {list.loading && !list.data ? <Loading /> : (
          <Table head={["Booking", "Customer → Technician", "Issue", "Photos", "Status", "Opened", ""]} empty={list.data?.items.length === 0}>
            {list.data?.items.map((w) => (
              <tr key={w.id}>
                <Td><p className="font-mono text-xs font-semibold">{w.bookingCode}</p><p className="text-xs text-slate-500">{w.serviceNameEn}</p></Td>
                <Td className="text-xs">{w.customerName} → {w.technicianName}</Td>
                <Td className="max-w-xs text-sm">{w.description}{w.resolutionNote && <p className="text-xs text-slate-500">Note: {w.resolutionNote}</p>}</Td>
                <Td><div className="flex gap-1">{w.mediaUrls.map((u) => <a key={u} href={fileUrl(u)!} target="_blank" rel="noreferrer"><img src={fileUrl(u)!} alt="warranty" className="h-10 w-10 rounded object-cover" /></a>)}</div></Td>
                <Td><StatusBadge status={w.status} /></Td>
                <Td className="text-xs text-slate-500">{fmtDate(w.createdAt)}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {w.status === "OPEN" && <Button size="sm" variant="outline" onClick={() => act(w.id, "accept")}>Accept</Button>}
                    {(w.status === "OPEN" || w.status === "ACCEPTED") && <Button size="sm" onClick={() => act(w.id, "resolve")}>Resolve</Button>}
                    {w.status === "OPEN" && <Button size="sm" variant="danger" onClick={() => act(w.id, "reject")}>Reject</Button>}
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
