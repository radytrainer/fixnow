"use client";

import { useState } from "react";
import { areaLabel } from "@fixnow/shared";
import { Alert, Button, Card, ErrorBox, Loading, PageHeader, Pager, SearchInput, Table, Td, fmtDate, usd } from "@/components/ui";
import { api, useApi } from "@/lib/api";

interface Customer {
  id: string; name: string | null; phoneMasked: string; isActive: boolean; createdAt: string; language: string;
  homeArea: string | null; bookingCount: number; totalPaid: string;
}

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const list = useApi<{ items: Customer[]; total: number; pageSize: number }>(`/admin/customers?page=${page}&pageSize=20${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Customers" sub="Phone numbers are masked. Revealing one is recorded in the audit log." />
      {err && <div className="mb-4"><Alert tone="danger">{err}</Alert></div>}
      <Card title="All customers" actions={<SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name…" label="Search" />}>
        {list.error && <ErrorBox error={list.error} retry={() => list.reload()} />}
        {list.loading && !list.data ? <Loading /> : (
          <Table head={["Customer", "Phone", "Area", "Language", "Bookings", "Total paid", "Joined", "Account"]} empty={list.data?.items.length === 0}>
            {list.data?.items.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <Td className="font-semibold">{c.name ?? "—"}</Td>
                <Td>
                  {revealed[c.id] ?? c.phoneMasked}{" "}
                  {!revealed[c.id] && (
                    <button className="ml-1 text-xs font-semibold text-blue-700 hover:underline" onClick={async () => {
                      try { const r = await api<{ phone: string }>(`/admin/users/${c.id}/reveal-phone`, { method: "POST" }); setRevealed((x) => ({ ...x, [c.id]: r.phone })); }
                      catch (e) { setErr((e as Error).message); }
                    }}>reveal</button>
                  )}
                </Td>
                <Td>{c.homeArea ? areaLabel(c.homeArea, "en", true) : "—"}</Td>
                <Td>{c.language === "km" ? "Khmer" : "English"}</Td>
                <Td>{c.bookingCount}</Td>
                <Td>{usd(c.totalPaid)}</Td>
                <Td className="text-xs text-slate-500">{fmtDate(c.createdAt)}</Td>
                <Td>
                  <Button size="sm" variant={c.isActive ? "danger" : "outline"} onClick={async () => {
                    try { await api(`/admin/users/${c.id}/active`, { method: "POST", body: { isActive: !c.isActive } }); list.reload(true); }
                    catch (e) { setErr((e as Error).message); }
                  }}>{c.isActive ? "Disable" : "Enable"}</Button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
        {list.data && <Pager page={page} total={list.data.total} pageSize={list.data.pageSize} onPage={setPage} noun="customers" />}
      </Card>
    </>
  );
}
