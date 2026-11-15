import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { LockedError } from "@/lib/api";

/**
 * Hash routing (#/planung?m=2027-01): GitHub Pages serves static files only, so the path must stay the same
 * and the page lives behind the "#".
 */
type Search = Record<string, string | boolean | undefined>;
export interface Loc { path: string; search: Record<string, string>; }

function href(to: string, search?: Search) {
  const q = new URLSearchParams(Object.entries(search ?? {}).filter(([, v]) => v !== undefined && v !== false).map(([k, v]) => [k, String(v)])).toString();
  return `#${to}${q ? `?${q}` : ""}`;
}
const subscribe = (cb: () => void) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); };

export function useLocation(): Loc {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return useMemo(() => {
    const [path, q = ""] = (hash.replace(/^#/, "") || "/").split("?");
    return { path: path || "/", search: Object.fromEntries(new URLSearchParams(q)) };
  }, [hash]);
}

const reloaders = new Set<() => Promise<void>>();
const router = {
  /** Reload whatever the visible page shows; resolves once the fresh data is in. */
  async invalidate() { await Promise.all([...reloaders].map(r => r())); },
  async navigate({ to, search }: { to: string; search?: Search }) { window.location.hash = href(to, search); },
};
export function useRouter() {
  return router;
}

export function Link({ to, search, className, children }: { to: string; search?: Search; className?: string; children: ReactNode }) {
  return <a href={href(to, search)} className={className}>{children}</a>;
}

/** Loads page data, keeps the old data on screen while reloading, and reloads on `router.invalidate()`. */
export function useLoader<T>(load: () => Promise<T>, key: string): { data: T | undefined; error: string | null } {
  const [state, setState] = useState<{ key: string; data?: T; error: string | null }>({ key, error: null });
  const latest = useRef(load);
  latest.current = load;
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const data = await latest.current();
        if (alive) setState({ key, data, error: null });
      } catch (err) {
        if (alive && !(err instanceof LockedError)) setState(s => ({ ...s, key, error: err instanceof Error ? err.message : "Laden fehlgeschlagen" }));
      }
    };
    void run();
    reloaders.add(run);
    return () => { alive = false; reloaders.delete(run); };
  }, [key]);
  return state.key === key ? { data: state.data, error: state.error } : { data: undefined, error: null };
}
