import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, type TranslationKey } from './en';
import { km } from './km';

export type Lang = 'en' | 'km';
const LANG_KEY = 'fixnow.lang';

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  /** Picks the English or Khmer field of a bilingual record. */
  pick: (en: string | null | undefined, km: string | null | undefined) => string;
  formatDate: (iso: string | Date, withTime?: boolean) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((v) => { if (v === 'en' || v === 'km') setLangState(v); }).catch(() => {});
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l).catch(() => {});
  }, []);

  const value = useMemo<I18n>(() => ({
    lang,
    setLang,
    t: (key, params) => {
      let s = (lang === 'km' ? km[key] : undefined) ?? en[key] ?? key;
      if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
      return s;
    },
    pick: (e, k) => (lang === 'km' ? k || e || '' : e || k || ''),
    formatDate: (iso, withTime = true) => {
      const d = new Date(iso);
      const locale = lang === 'km' ? 'km-KH' : 'en-GB';
      try {
        return d.toLocaleString(locale, {
          day: 'numeric', month: 'short', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
          timeZone: 'Asia/Phnom_Penh',
        });
      } catch {
        return d.toISOString().slice(0, 16).replace('T', ' ');
      }
    },
  }), [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside provider');
  return v;
}
