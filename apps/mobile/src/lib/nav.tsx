import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BackHandler } from 'react-native';

/**
 * Minimal role-scoped navigator: a set of bottom tabs, each with its own stack.
 * Customers and technicians get completely separate tab/route sets (see RoleNavigator).
 */
export interface Route { name: string; params?: Record<string, any> }

interface Nav {
  tab: string;
  stack: Route[];
  current: Route;
  push: (name: string, params?: Record<string, any>) => void;
  replace: (name: string, params?: Record<string, any>) => void;
  pop: () => void;
  popToRoot: () => void;
  switchTab: (tab: string, then?: Route) => void;
}

const Ctx = createContext<Nav | null>(null);

export function NavProvider({ tabs, children }: { tabs: Record<string, Route>; children: ReactNode }) {
  const firstTab = Object.keys(tabs)[0];
  const [tab, setTab] = useState(firstTab);
  const [stacks, setStacks] = useState<Record<string, Route[]>>(() =>
    Object.fromEntries(Object.entries(tabs).map(([k, root]) => [k, [root]])));

  const stack = stacks[tab];
  const update = useCallback((fn: (s: Route[]) => Route[]) => setStacks((all) => ({ ...all, [tab]: fn(all[tab]) })), [tab]);

  const nav = useMemo<Nav>(() => ({
    tab, stack, current: stack[stack.length - 1],
    push: (name, params) => update((s) => [...s, { name, params }]),
    replace: (name, params) => update((s) => [...s.slice(0, -1), { name, params }]),
    pop: () => update((s) => (s.length > 1 ? s.slice(0, -1) : s)),
    popToRoot: () => update((s) => [s[0]]),
    switchTab: (t, then) => {
      setTab(t);
      if (then) setStacks((all) => ({ ...all, [t]: [all[t][0], then] }));
    },
  }), [tab, stack, update]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) { nav.pop(); return true; }
      if (tab !== firstTab) { setTab(firstTab); return true; }
      return false;
    });
    return () => sub.remove();
  }, [nav, stack.length, tab, firstTab]);

  return <Ctx.Provider value={nav}>{children}</Ctx.Provider>;
}

export function useNav() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNav outside provider');
  return v;
}
