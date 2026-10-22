"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const TOKEN_KEY = "fixnow.admin.token";
export const SESSION_COOKIE = "fixnow_admin_session";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setSession(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage blocked */ }
  // Presence cookie for the proxy's optimistic redirect. Real authorization is enforced by the API on every call.
  document.cookie = token
    ? `${SESSION_COOKIE}=1; path=/; max-age=${7 * 86400}; samesite=lax`
    : `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: opts.method ?? "GET",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Cannot reach the FixNow API. Is it running?");
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      if (path !== "/auth/admin-login") {
        setSession(null);
        window.location.href = "/login";
      }
    }
    throw new ApiError(res.status, json?.code ?? "ERROR", json?.message ?? `HTTP ${res.status}`);
  }
  return json as T;
}

/** Authenticated file download (CSV export) — keeps the token out of the URL. */
export async function download(path: string, filename: string) {
  const res = await fetch(`${API_URL}/api${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new ApiError(res.status, "ERROR", "Download failed");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const fileUrl = (rel: string | null | undefined) => (rel ? `${API_URL}${rel}` : null);

export function useApi<T>(path: string | null, pollMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(!!path);
  const alive = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!path) return;
    if (!silent) setLoading(true);
    try {
      const d = await api<T>(path);
      if (alive.current) { setData(d); setError(null); }
    } catch (e) {
      if (alive.current) setError(e as Error);
    } finally {
      if (alive.current && !silent) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, [load]);

  useEffect(() => {
    if (!pollMs || !path) return;
    const id = setInterval(() => load(true), pollMs);
    return () => clearInterval(id);
  }, [pollMs, path, load]);

  return { data, error, loading, reload: load };
}
