"use client";

import { Activity, BadgeCheck, Eye, EyeOff, House, LockKeyhole, Phone, ShieldCheck, Wallet, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoginIllustration } from "@/components/LoginIllustration";
import { Alert, Button, DemoTag } from "@/components/ui";
import { api, setSession } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/** FixNow mark: house tile with the orange wrench badge (same as the mobile app). */
function BrandMark({ small }: { small?: boolean }) {
  const box = small ? "h-9 w-9 rounded-xl" : "h-11 w-11 rounded-2xl";
  return (
    <span className={`relative flex items-center justify-center bg-brand-600 text-white ${box}`}>
      <House className={small ? "h-[18px] w-[18px]" : "h-5 w-5"} aria-hidden />
      <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-[#0B1B4D] bg-orange-500">
        <Wrench className="h-2.5 w-2.5" aria-hidden />
      </span>
    </span>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { tr, lang, setLang } = useI18n();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
  const tasks: Array<[typeof BadgeCheck, string]> = [
    [BadgeCheck, "Approve technicians after checking ID and certificates"],
    [Activity, "Follow every booking live, from request to rating"],
    [Wallet, "Confirm payments and track technician payouts"],
  ];

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col overflow-hidden bg-[#0B1B4D] p-12 text-white lg:flex xl:p-14">
        {/* background: brand glow + dot grid */}
        <div className="pointer-events-none absolute -left-40 top-1/3 h-[560px] w-[560px] rounded-full bg-brand-600/40 blur-[120px]" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-[420px] w-[420px] rounded-full bg-violet-600/25 blur-[120px]" aria-hidden />
        <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:radial-gradient(rgb(255_255_255/0.5)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" aria-hidden />

        <div className="relative flex items-center gap-3">
          <BrandMark />
          <span className="text-xl font-extrabold">Fix<span className="text-orange-400">Now</span></span>
          <span className="ml-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-blue-100">{tr("Admin console")}</span>
        </div>

        <div className="relative my-auto py-10 [@media(max-height:860px)]:py-6">
          <LoginIllustration />
          <div className="mt-14 max-w-lg [@media(max-height:860px)]:mt-10">
            <h2 className="text-[34px] font-bold leading-[1.15] tracking-tight">{tr("Run every repair in Sen Sok from one place.")}</h2>
            <ul className="mt-6 space-y-3">
              {tasks.map(([Icon, text]) => (
                <li key={text} className="flex items-center gap-3 text-[15px] text-blue-100">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-blue-200"><Icon className="h-4 w-4" aria-hidden /></span>
                  {tr(text)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="relative text-xs text-blue-200/80">{tr("Phnom Penh Thmei · Tuek Thla pilot")}</p>
      </section>

      <section className="flex flex-col bg-canvas p-4 sm:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:invisible">
            <BrandMark small />
            <span className="text-lg font-extrabold text-ink">Fix<span className="text-orange-500">Now</span></span>
          </div>
          <div className="flex rounded-lg border border-line bg-surface p-1 text-xs font-semibold shadow-sm" role="group" aria-label="Language">
            {(["en", "km"] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
                className={`h-7 rounded-md px-2.5 transition ${lang === l ? "bg-brand-600 text-white" : "text-ink-3 hover:text-ink"}`}>{l === "en" ? "EN" : "ខ្មែរ"}</button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <form className="w-full max-w-[400px]" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="rounded-2xl border border-line bg-surface p-7 shadow-pop sm:p-8">
              <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><LockKeyhole className="h-5 w-5" aria-hidden /></span>
              <h1 className="text-2xl font-bold tracking-tight text-ink">{tr("Welcome back")}</h1>
              <p className="mb-6 mt-1 text-sm text-ink-3">{tr("Sign in to the admin console · staff only")}</p>
              {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}

              <label className="mb-1.5 block text-sm font-medium text-ink-2" htmlFor="phone">{tr("Admin phone")}</label>
              <div className="relative mb-4">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
                <input id="phone" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+855 12 000 001" autoComplete="username" inputMode="tel" className={field} />
              </div>
              <label className="mb-1.5 block text-sm font-medium text-ink-2" htmlFor="password">{tr("Password")}</label>
              <div className="relative mb-6">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
                <input id="password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password" className={`${field} pr-11`} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={tr(showPassword ? "Hide password" : "Show password")} aria-pressed={showPassword}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 transition hover:bg-slate-100 hover:text-ink">
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
              <div className="[&>button]:h-11 [&>button]:w-full">
                <Button type="submit" onClick={submit} disabled={!phone || !password}>Sign in</Button>
              </div>
              <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-3">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />{tr("Protected area · every admin action is audited")}
              </p>
            </div>

            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-orange-200 bg-orange-50 p-3.5 text-xs text-orange-900">
              <DemoTag />
              <span>{tr("Competition demo admin:")} <b>+85512000001</b> / <b>FixNowAdmin#2026</b></span>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
