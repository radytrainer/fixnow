import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { fromCents, toCents, type ServiceDto } from '@fixnow/shared';

export const MAX_SERVICES_PER_BOOKING = 5;

interface Selection {
  items: ServiceDto[];
  has: (id: string) => boolean;
  toggle: (s: ServiceDto) => void;
  clear: () => void;
  /** Combined estimate: sum of each selected service's min and max price. */
  range: { min: string; max: string } | null;
}

const Ctx = createContext<Selection | null>(null);

/** Customer's in-progress service selection; kept while they browse between categories. */
export function ServiceSelectionProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ServiceDto[]>([]);
  const toggle = useCallback((s: ServiceDto) => setItems((xs) => (
    xs.some((x) => x.id === s.id) ? xs.filter((x) => x.id !== s.id) : xs.length >= MAX_SERVICES_PER_BOOKING ? xs : [...xs, s]
  )), []);
  const value = useMemo<Selection>(() => ({
    items,
    has: (id) => items.some((x) => x.id === id),
    toggle,
    clear: () => setItems([]),
    range: items.length && items.every((s) => s.minPrice && s.maxPrice)
      ? { min: fromCents(items.reduce((a, s) => a + toCents(s.minPrice!), 0)), max: fromCents(items.reduce((a, s) => a + toCents(s.maxPrice!), 0)) }
      : null,
  }), [items, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useServiceSelection() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useServiceSelection outside provider');
  return v;
}
