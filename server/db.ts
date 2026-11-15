/** Minimal table access. The real one talks to Supabase's REST API, the test one keeps rows in memory. */
export type Op = "eq" | "neq" | "gte" | "lt";
export type Filter = [column: string, op: Op, value: string | number | boolean];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
export interface Query { where?: Filter[]; order?: string[]; limit?: number; }

export interface Db {
  select(table: string, q?: Query): Promise<Row[]>;
  /** With `onConflict` (comma-separated key columns) existing rows are replaced. */
  insert(table: string, rows: Row[], onConflict?: string): Promise<void>;
  update(table: string, patch: Row, where: Filter[]): Promise<void>;
  remove(table: string, where: Filter[]): Promise<void>;
}

const PAGE = 1000;

export function restDb(url: string, serviceKey: string, f: typeof fetch = fetch): Db {
  const base = `${url.replace(/\/+$/, "")}/rest/v1`;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  const filters = (where: Filter[] = []) => where.map(([c, op, v]) => `${c}=${op}.${encodeURIComponent(String(v))}`);
  async function send(method: string, path: string, body?: unknown, prefer?: string) {
    const res = await f(`${base}/${path}`, { method, headers: prefer ? { ...headers, Prefer: prefer } : headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) throw new Error(`Datenbank ${method} ${path.split("?")[0]}: ${res.status} ${(await res.text()).slice(0, 300)}`);
    return res;
  }
  return {
    async select(table, q = {}) {
      const out: Row[] = [];
      const max = q.limit ?? Infinity;
      for (let offset = 0; out.length < max; offset += PAGE) {
        const params = [...filters(q.where), "select=*", `limit=${Math.min(PAGE, max - out.length)}`, `offset=${offset}`];
        if (q.order?.length) params.push(`order=${q.order.join(",")}`);
        const rows = (await (await send("GET", `${table}?${params.join("&")}`)).json()) as Row[];
        out.push(...rows);
        if (rows.length < PAGE) break;
      }
      return out;
    },
    async insert(table, rows, onConflict) {
      if (!rows.length) return;
      const path = onConflict ? `${table}?on_conflict=${onConflict}` : table;
      await send("POST", path, rows, onConflict ? "resolution=merge-duplicates,return=minimal" : "return=minimal");
    },
    async update(table, patch, where) {
      if (!where.length) throw new Error("Update ohne Bedingung");
      await send("PATCH", `${table}?${filters(where).join("&")}`, patch, "return=minimal");
    },
    async remove(table, where) {
      if (!where.length) throw new Error("Löschen ohne Bedingung");
      await send("DELETE", `${table}?${filters(where).join("&")}`, undefined, "return=minimal");
    },
  };
}

/** In-memory stand-in with the same behaviour, for tests. */
export function memoryDb(seed: Record<string, Row[]> = {}): Db & { tables: Record<string, Row[]> } {
  const tables: Record<string, Row[]> = Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v.map(r => ({ ...r }))]));
  const rowsOf = (t: string) => (tables[t] ??= []);
  const match = (r: Row, where: Filter[] = []) => where.every(([c, op, v]) =>
    op === "eq" ? r[c] === v : op === "neq" ? r[c] !== v : op === "gte" ? r[c] >= v : r[c] < v);
  return {
    tables,
    async select(table, q = {}) {
      const out = rowsOf(table).filter(r => match(r, q.where)).map(r => ({ ...r }));
      for (const o of [...(q.order ?? [])].reverse()) {
        const [col, dir] = o.split(".");
        out.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (dir === "desc" ? -1 : 1));
      }
      return q.limit ? out.slice(0, q.limit) : out;
    },
    async insert(table, rows, onConflict) {
      const keys = onConflict?.split(",");
      for (const row of rows) {
        const list = rowsOf(table);
        const i = keys ? list.findIndex(r => keys.every(k => r[k] === row[k])) : -1;
        if (i >= 0) list[i] = { ...list[i], ...row };
        else list.push({ ...row });
      }
    },
    async update(table, patch, where) {
      if (!where.length) throw new Error("Update ohne Bedingung");
      for (const r of rowsOf(table)) if (match(r, where)) Object.assign(r, patch);
    },
    async remove(table, where) {
      if (!where.length) throw new Error("Löschen ohne Bedingung");
      tables[table] = rowsOf(table).filter(r => !match(r, where));
    },
  };
}
