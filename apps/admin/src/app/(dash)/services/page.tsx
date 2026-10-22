"use client";

import { useState } from "react";
import type { ServiceCategoryDto, ServiceDto } from "@fixnow/shared";
import { Alert, Button, Card, ErrorBox, Loading, PageHeader, StatusBadge, Table, Td } from "@/components/ui";
import { api, useApi } from "@/lib/api";

type Draft = { categoryId: string; nameEn: string; nameKm: string; descriptionEn: string; minPrice: string; maxPrice: string; status: "ACTIVE" | "COMING_SOON" };

function ServiceRow({ s, onSaved, onError }: { s: ServiceDto; onSaved: () => void; onError: (m: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [min, setMin] = useState(s.minPrice ?? "");
  const [max, setMax] = useState(s.maxPrice ?? "");
  const save = async (patch: Record<string, unknown>) => {
    try { await api(`/admin/services/${s.id}`, { method: "PATCH", body: patch }); setEdit(false); onSaved(); }
    catch (e) { onError((e as Error).message); }
  };
  return (
    <tr className="hover:bg-slate-50">
      <Td><p className="font-semibold">{s.nameEn}</p><p className="font-[family-name:var(--font-khmer)] text-xs text-slate-500">{s.nameKm}</p></Td>
      <Td>
        {edit ? (
          <div className="flex items-center gap-1">
            $<input aria-label="Minimum price" value={min} onChange={(e) => setMin(e.target.value)} className="h-8 w-20 rounded border border-slate-300 px-2" />
            – $<input aria-label="Maximum price" value={max} onChange={(e) => setMax(e.target.value)} className="h-8 w-20 rounded border border-slate-300 px-2" />
          </div>
        ) : <span>${s.minPrice} – ${s.maxPrice}</span>}
      </Td>
      <Td><StatusBadge status={s.status} /></Td>
      <Td>
        <div className="flex flex-wrap gap-2">
          {edit ? <Button size="sm" onClick={() => save({ minPrice: min || null, maxPrice: max || null })}>Save</Button>
            : <Button size="sm" variant="outline" onClick={() => setEdit(true)}>Edit prices</Button>}
          <Button size="sm" variant="ghost" onClick={() => save({ status: s.status === "ACTIVE" ? "COMING_SOON" : "ACTIVE" })}>
            {s.status === "ACTIVE" ? "Set coming soon" : "Activate"}
          </Button>
        </div>
      </Td>
    </tr>
  );
}

export default function ServicesPage() {
  const cat = useApi<{ items: ServiceCategoryDto[] }>("/admin/services");
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  if (cat.loading && !cat.data) return <Loading />;
  if (cat.error && !cat.data) return <ErrorBox error={cat.error} retry={() => cat.reload()} />;

  const create = async () => {
    if (!draft) return;
    setErr(null);
    try {
      await api("/admin/services", { method: "POST", body: { ...draft, descriptionEn: draft.descriptionEn || null, minPrice: draft.minPrice || null, maxPrice: draft.maxPrice || null } });
      setDraft(null);
      cat.reload(true);
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <>
      <PageHeader title="Services & pricing" sub="Launch catalogue: AC and electrical are active; plumbing and home appliances are Coming soon."
        actions={<Button onClick={() => setDraft({ categoryId: cat.data!.items[0].id, nameEn: "", nameKm: "", descriptionEn: "", minPrice: "", maxPrice: "", status: "ACTIVE" })}>+ New service</Button>} />
      {err && <div className="mb-4"><Alert tone="danger">{err}</Alert></div>}
      {draft && (
        <Card title="New service" className="mb-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Category
              <select value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-2">
                {cat.data!.items.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
              </select>
            </label>
            <label className="text-sm">Status
              <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft["status"] })} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-2">
                <option value="ACTIVE">Active</option><option value="COMING_SOON">Coming soon</option>
              </select>
            </label>
            {([["nameEn", "Name (English)"], ["nameKm", "Name (Khmer)"], ["descriptionEn", "Description"], ["minPrice", "Min price (USD)"], ["maxPrice", "Max price (USD)"]] as const).map(([k, l]) => (
              <label key={k} className="text-sm">{l}
                <input value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3" />
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={create} disabled={!draft.nameEn || !draft.nameKm}>Create</Button>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </Card>
      )}
      <div className="space-y-5">
        {cat.data!.items.map((c) => (
          <Card key={c.id} title={<span>{c.nameEn} <span className="ml-1 font-[family-name:var(--font-khmer)] font-normal text-slate-500">{c.nameKm}</span></span>}
            actions={<>
              <StatusBadge status={c.status} />
              <Button size="sm" variant="outline" onClick={async () => {
                try { await api(`/admin/categories/${c.id}`, { method: "PATCH", body: { status: c.status === "ACTIVE" ? "COMING_SOON" : "ACTIVE" } }); cat.reload(true); }
                catch (e) { setErr((e as Error).message); }
              }}>{c.status === "ACTIVE" ? "Set category coming soon" : "Activate category"}</Button>
            </>}>
            <Table head={["Service", "Price range", "Status", ""]} empty={c.services.length === 0}>
              {c.services.map((s) => <ServiceRow key={s.id} s={s} onSaved={() => cat.reload(true)} onError={setErr} />)}
            </Table>
          </Card>
        ))}
      </div>
    </>
  );
}
