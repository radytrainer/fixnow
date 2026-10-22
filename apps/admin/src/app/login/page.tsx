"use client";

import { House, LockKeyhole, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, DemoTag } from "@/components/ui";
import { api, setSession } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const { tr, lang, setLang } = useI18n();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const r = await api<{ token: string }>("/auth/admin-login", { method: "POST", body: { phone, password } });
      setSession(r.token);
      router.replace("/");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const field = "h-11 w-full rounded-lg border border-line bg-surface pl-10 pr-3 text-sm outline-none transition placeholder:text-ink-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-violet-700 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><House className="h-5 w-5" aria-hidden /></span>
          <span className="text-xl font-extrabold">Fix<span className="text-orange-300">Now</span></span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-bold leading-tight">Trusted, fast home repairs in Sen Sok.</h2>
          <p className="mt-3 text-blue-100">Verify technicians, monitor every booking in real time, and keep payments and payouts traceable.</p>
        </div>
        <p className="text-xs text-blue-200">Phnom Penh Thmei · Tuek Thla pilot</p>
      </section>

      <section className="flex items-center justify-center bg-canvas p-4 sm:p-8">
        <form className="w-full max-w-sm" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2.5 lg:hidden">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 text-white"><House className="h-[18px] w-[18px]" aria-hidden /></span>
              <span className="text-lg font-extrabold text-ink">Fix<span className="text-orange-500">Now</span></span>
            </div>
            <div className="ml-auto flex rounded-lg bg-slate-100 p-1 text-xs font-semibold" role="group" aria-label="Language">
              {(["en", "km"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
                  className={`h-7 rounded-md px-2.5 ${lang === l ? "bg-surface text-ink shadow-sm" : "text-ink-3"}`}>{l === "en" ? "EN" : "ខ្មែរ"}</button>
              ))}
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{tr("Sign in")}</h1>
          <p className="mb-6 mt-1 text-sm text-ink-3">{tr("Admin console · staff only")}</p>
          {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}

          <label className="mb-1.5 block text-sm font-medium text-ink-2" htmlFor="phone">{tr("Admin phone")}</label>
          <div className="relative mb-4">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input id="phone" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+855 12 000 001" autoComplete="username" inputMode="tel" className={field} />
          </div>
          <label className="mb-1.5 block text-sm font-medium text-ink-2" htmlFor="password">{tr("Password")}</label>
          <div className="relative mb-6">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input id="password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={field} />
          </div>
          <div className="[&>button]:w-full">
            <Button type="submit" onClick={submit} disabled={!phone || !password}>Sign in</Button>
          </div>
          <div className="mt-6 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
            <DemoTag />
            <span>Competition demo admin: <b>+85512000001</b> / <b>FixNowAdmin#2026</b></span>
          </div>
        </form>
      </section>
    </main>
  );
}
