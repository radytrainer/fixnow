"use client";

import { Ban, Check, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { areaLabel } from "@fixnow/shared";
import { Alert, Badge, Button, Card, Drawer, ErrorBox, Filters, KV, Loading, PageHeader, Pager, StatusBadge, Table, Td, fmtDate } from "@/components/ui";
import { api, fileUrl, useApi } from "@/lib/api";

interface TechRow {
  id: string; userId: string; name: string; phoneMasked: string; status: string; isAvailable: boolean; isActive: boolean;
  serviceArea: string; yearsExperience: number; services: string[]; ratingAvg: number | null; bookingCount: number; createdAt: string;
}
interface TechDetail {
  id: string; userId: string; name: string; phone: string; status: string; bio: string | null; yearsExperience: number; serviceArea: string;
  services: string[]; certificateSummary: string | null; idDocumentNumber: string | null; idDocumentUrl: string | null;
  certificateUrl: string | null; photoUrl: string | null; rejectionReason: string | null; reviewedBy: string | null; reviewedAt: string | null; createdAt: string;
}

const AREA = new Proxy({} as Record<string, string>, { get: (_t, code: string) => areaLabel(code, "en", true) });

function Detail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const d = useApi<TechDetail>(`/admin/technicians/${id}`);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const t = d.data;
  if (!t) return d.error ? <ErrorBox error={d.error} /> : <Loading />;
  const act = async (action: string) => {
    setErr(null);
    try {
      await api(`/admin/technicians/${t.id}/${action}`, { method: "POST", body: { reason: reason || undefined } });
      setReason("");
      d.reload(true);
      onChanged();
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        {t.photoUrl
          ? <img src={fileUrl(t.photoUrl)!} alt="" className="h-16 w-16 rounded-full object-cover" />
          : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-xl font-bold text-violet-700">{t.name.split(" ").map((s) => s[0]).join("")}</div>}
        <div>
          <p className="text-lg font-bold">{t.name}</p>
          <StatusBadge status={t.status} />
        </div>
      </div>
      <div>
        <KV k="Phone (admin only)" v={t.phone} />
        <KV k="Service area" v={AREA[t.serviceArea] ?? t.serviceArea} />
        <KV k="Experience" v={`${t.yearsExperience} years`} />
        <KV k="Services" v={t.services.join(", ")} />
        <KV k="Certificates" v={t.certificateSummary ?? "—"} />
        <KV k="National ID no." v={t.idDocumentNumber ?? "—"} />
        <KV k="Applied" v={fmtDate(t.createdAt)} />
        {t.reviewedAt && <KV k="Last review" v={`${t.reviewedBy ?? "—"} · ${fmtDate(t.reviewedAt)}`} />}
        {t.rejectionReason && <KV k="Reason" v={t.rejectionReason} />}
      </div>
      {t.bio && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{t.bio}</p>}
      <div>
        <p className="mb-2 text-sm font-semibold">Private documents <span className="font-normal text-slate-500">(signed links, expire in 15 min)</span></p>
        <div className="grid grid-cols-2 gap-3">
          {[["ID card", t.idDocumentUrl], ["Certificate", t.certificateUrl]].map(([label, url]) => (
            <a key={label} href={url ? fileUrl(url)! : undefined} target="_blank" rel="noreferrer"
              className={`block rounded-xl border p-3 text-center text-sm ${url ? "border-slate-200 hover:border-blue-400" : "pointer-events-none border-dashed border-slate-200 text-slate-400"}`}>
              {url ? <img src={fileUrl(url)!} alt={`${label} document`} className="mx-auto mb-2 h-28 object-contain" /> : <p className="py-10">Not provided</p>}
              {label}
            </a>
          ))}
        </div>
      </div>
      {err && <Alert tone="danger">{err}</Alert>}
      <div className="space-y-3 rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold">Verification decision</p>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required to reject or suspend)"
          className="h-10 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        <div className="flex flex-wrap gap-2">
          {(t.status === "PENDING" || t.status === "REJECTED") && <Button icon={Check} onClick={() => act("approve")}>Approve</Button>}
          {t.status === "PENDING" && <Button variant="danger" icon={X} disabled={!reason} onClick={() => act("reject")}>Reject</Button>}
          {t.status === "APPROVED" && <Button variant="danger" icon={Ban} disabled={!reason} onClick={() => act("suspend")}>Suspend</Button>}
          {t.status === "SUSPENDED" && <Button icon={RotateCcw} onClick={() => act("reinstate")}>Reinstate</Button>}
        </div>
        <p className="text-xs text-slate-500">Every decision is written to the audit log with your name and the time.</p>
      </div>
    </div>
  );
}

export default function TechniciansPage() {
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED" | "">("PENDING");
  const [page, setPage] = useState(1);
  const list = useApi<{ items: TechRow[]; total: number; pageSize: number }>(`/admin/technicians?page=${page}&pageSize=20${status ? `&status=${status}` : ""}`, 10000);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHeader title="Technicians" sub="Verify identity and certificates before a technician can receive jobs." />
      <Card actions={<Filters value={status} onChange={(v) => { setStatus(v); setPage(1); }} label="Status filter"
        options={[["PENDING", "Approval queue"], ["APPROVED", "Approved"], ["SUSPENDED", "Suspended"], ["REJECTED", "Rejected"], ["", "All"]]} />}>
        {list.error && <ErrorBox error={list.error} retry={() => list.reload()} />}
        {list.loading && !list.data ? <Loading /> : (
          <Table head={["Technician", "Status", "Area", "Services", "Rating", "Jobs", "Applied", ""]} empty={list.data?.items.length === 0}>
            {list.data?.items.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <Td><p className="font-semibold">{t.name}</p><p className="text-xs text-slate-500">{t.phoneMasked}</p></Td>
                <Td><StatusBadge status={t.status} /> {t.status === "APPROVED" && !t.isAvailable && <Badge>offline</Badge>}</Td>
                <Td>{AREA[t.serviceArea] ?? t.serviceArea}</Td>
                <Td className="max-w-[220px] truncate text-xs text-slate-600">{t.services.join(", ")}</Td>
                <Td>{t.ratingAvg ? `★ ${t.ratingAvg.toFixed(1)}` : "—"}</Td>
                <Td>{t.bookingCount}</Td>
                <Td className="text-xs text-slate-500">{fmtDate(t.createdAt)}</Td>
                <Td><Button size="sm" variant={t.status === "PENDING" ? "primary" : "outline"} onClick={() => setOpen(t.id)}>{t.status === "PENDING" ? "Review" : "View"}</Button></Td>
              </tr>
            ))}
          </Table>
        )}
        {list.data && <Pager page={page} total={list.data.total} pageSize={list.data.pageSize} onPage={setPage} noun="technicians" />}
      </Card>
      <Drawer open={!!open} onClose={() => setOpen(null)} title="Technician verification">
        {open && <Detail id={open} onChanged={() => list.reload(true)} />}
      </Drawer>
    </>
  );
}
