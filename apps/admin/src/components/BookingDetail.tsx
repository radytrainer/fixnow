"use client";

import { useState } from "react";
import { areaLabel, type BookingDto } from "@fixnow/shared";
import { Countdown } from "@/components/Countdown";
import { Alert, Button, DemoTag, ErrorBox, KV, Loading, StatusBadge, fmtDate, usd } from "@/components/ui";
import { api, fileUrl, useApi } from "@/lib/api";
import { useTr } from "@/lib/i18n";

const AREA = new Proxy({} as Record<string, string>, { get: (_t, code: string) => areaLabel(code, "en", true) });

interface Timeline {
  customer: { id: string; name: string; phoneMasked: string };
  technician: { id: string; name: string; phoneMasked: string };
  events: Array<{ at: string; label: string; detail?: string }>;
}

export function BookingDetail({ id, onChanged }: { id: string; onChanged?: () => void }) {
  const b = useApi<BookingDto>(`/bookings/${id}`, 4000);
  const tl = useApi<Timeline>(`/admin/bookings/${id}/timeline`, 4000);
  const [err, setErr] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const tr = useTr();
  if (!b.data) return b.error ? <ErrorBox error={b.error} /> : <Loading />;
  const d = b.data;
  const act = async (path: string, body?: unknown) => {
    setErr(null);
    try { await api(path, { method: "POST", body }); b.reload(true); tl.reload(true); onChanged?.(); }
    catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={d.status} />
        {d.status === "REQUESTED" && <span className="text-sm text-slate-500">responds in <Countdown deadline={d.responseDeadlineAt} serverNow={d.serverNow} /></span>}
      </div>
      {err && <Alert tone="danger">{err}</Alert>}
      <div>
        <KV k="Service" v={d.services.length > 1 ? <span>{d.services.map((s) => <span key={s.id} className="block">{s.nameEn} <span className="text-ink-3">(${Number(s.minPrice)}–${Number(s.maxPrice)})</span></span>)}</span> : d.service.nameEn} />
        <KV k="Customer" v={tl.data ? `${tl.data.customer.name} · ${tl.data.customer.phoneMasked}` : "…"} />
        <KV k="Technician" v={tl.data ? `${tl.data.technician.name} · ${tl.data.technician.phoneMasked}` : "…"} />
        <KV k="Scheduled" v={fmtDate(d.scheduledAt)} />
        <KV k="Area" v={AREA[d.serviceArea] ?? d.serviceArea} />
        <KV k="Address" v={d.serviceAddressText ?? "—"} />
        <KV k="Response deadline" v={fmtDate(d.responseDeadlineAt)} />
        {d.cancelReason && <KV k="Cancel reason" v={d.cancelReason} />}
      </div>
      {d.serviceLat != null && d.serviceLng != null && (
        <div>
          <iframe
            title="Service location map" loading="lazy" className="h-48 w-full rounded-xl border border-slate-200"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${d.serviceLng - 0.006},${d.serviceLat - 0.004},${d.serviceLng + 0.006},${d.serviceLat + 0.004}&layer=mapnik&marker=${d.serviceLat},${d.serviceLng}`}
          />
          <a className="text-xs font-semibold text-blue-700 hover:underline" target="_blank" rel="noreferrer"
            href={`https://www.google.com/maps/search/?api=1&query=${d.serviceLat},${d.serviceLng}`}>{tr("Open in Google Maps ↗")}</a>
        </div>
      )}
      <p className="rounded-lg bg-slate-50 p-3 text-sm">{d.problemDescription}</p>
      {d.media.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {d.media.map((m) => (
            <a key={m.id} href={fileUrl(m.url)!} target="_blank" rel="noreferrer" className="block">
              {m.mediaType === "PHOTO" ? <img src={fileUrl(m.url)!} alt={`${m.purpose} photo`} className="h-20 w-20 rounded-lg object-cover" />
                : <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-slate-100 text-2xl">🎬</div>}
              <p className="text-center text-[10px] text-slate-500">{m.purpose.toLowerCase()}</p>
            </a>
          ))}
        </div>
      )}
      {d.payment && (
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">Payment</p>
            <div className="flex gap-2">{d.payment.isDemo && <DemoTag />}<StatusBadge status={d.payment.status} /></div>
          </div>
          <KV k="Gross" v={usd(d.payment.amount)} />
          <KV k={`Commission (${Number(d.payment.commissionRate)}%)`} v={usd(d.payment.commissionAmount)} />
          <KV k="Technician net" v={usd(d.payment.technicianNet)} />
          <KV k="Payout" v={d.payment.payoutStatus ?? "—"} />
          {d.payment.status === "PENDING" && d.status === "FINISHED" && (
            <div className="mt-3"><Button variant="accent" onClick={() => act(`/admin/payments/${d.payment!.id}/confirm-demo`)}>Confirm simulated payment</Button></div>
          )}
        </div>
      )}
      {d.rating && <KV k="Rating" v={`${"★".repeat(d.rating.score)} ${d.rating.comment ?? ""}`} />}
      <div>
        <p className="mb-2 text-sm font-semibold">Timeline & audit trail</p>
        <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
          {tl.data?.events.map((e, i) => (
            <li key={i} className="text-sm">
              <p className="font-medium">{e.label.replace(/_/g, " ")}</p>
              <p className="text-xs text-slate-500">{fmtDate(e.at)}{e.detail ? ` · ${e.detail}` : ""}</p>
            </li>
          ))}
        </ol>
      </div>
      <div className="space-y-2 rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold">Admin actions</p>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason / note" className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        <div className="flex flex-wrap gap-2">
          {["REQUESTED", "ACCEPTED", "CONFIRMED"].includes(d.status) && <Button size="sm" variant="danger" onClick={() => act(`/bookings/${d.id}/cancel`, { reason })}>Cancel booking</Button>}
          {["ACCEPTED", "CONFIRMED", "FINISHED", "PAID", "RATED"].includes(d.status) && <Button size="sm" variant="danger" onClick={() => act(`/admin/bookings/${d.id}/dispute`, { reason })}>Mark disputed</Button>}
          {["PAID", "RATED", "DISPUTED", "CUSTOMER_NOT_AVAILABLE"].includes(d.status) && <Button size="sm" variant="outline" onClick={() => act(`/admin/bookings/${d.id}/close`, { reason })}>Close</Button>}
        </div>
      </div>
    </div>
  );
}

