"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AppRole = "ADMIN" | "OPS" | "CLIENT";

type CompanyRow = {
  id: string;
  ref_id: string;
  name: string;
  industry: string | null;
  website: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  logo_mime: string | null;
  has_logo: boolean;
};

type ApiResponse = {
  items: CompanyRow[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
};

function highlight(text: string, q: string) {
  if (!q || q.length < 2) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const mid = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <>
      {before}
      <mark>{mid}</mark>
      {after}
    </>
  );
}

export default function CompaniesClient({ role }: { role: AppRole }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"name" | "ref_id" | "created_at">("name");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canEdit = role !== "CLIENT";

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim().length >= 2) p.set("q", q.trim());
    p.set("sort", sort);
    p.set("dir", dir);
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return p.toString();
  }, [q, sort, dir, page, pageSize]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/companies?${queryString}`, { cache: "no-store" });
        const json = (await res.json()) as ApiResponse;
        if (!res.ok) throw new Error(json?.error || "Failed to load companies");
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load companies");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const totalPages = useMemo(() => {
    const total = data?.total ?? 0;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [data, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="input"
          style={{ maxWidth: 420 }}
          placeholder="Search (name, ref id, industry)…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />

        <select
          className="input"
          style={{ width: 180 }}
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as any);
            setPage(1);
          }}
        >
          <option value="name">Sort: Name</option>
          <option value="ref_id">Sort: Ref ID</option>
          <option value="created_at">Sort: Created</option>
        </select>

        <select
          className="input"
          style={{ width: 140 }}
          value={dir}
          onChange={(e) => {
            setDir(e.target.value as any);
            setPage(1);
          }}
        >
          <option value="asc">Asc</option>
          <option value="desc">Desc</option>
        </select>

        <select
          className="input"
          style={{ width: 140 }}
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>

        <div style={{ flex: 1 }} />

        {canEdit && (
          <Link className="btn primary" href="/companies/new">
            + New company
          </Link>
        )}
      </div>

      {err && <div className="notice bad">{err}</div>}

      <div className="card" style={{ overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 64 }}>Logo</th>
              <th style={{ width: 110 }}>Ref ID</th>
              <th>Name</th>
              <th style={{ width: 220 }}>Industry</th>
              <th style={{ width: 260 }}>Website</th>
              <th style={{ width: 120 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} style={{ padding: 14, color: "var(--muted)" }}>
                  Loading…
                </td>
              </tr>
            )}

            {!loading && (data?.items?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 14, color: "var(--muted)" }}>
                  No companies found.
                </td>
              </tr>
            )}

            {!loading &&
              (data?.items ?? []).map((c) => (
                <tr key={c.id}>
                  <td>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        border: "1px solid var(--line)",
                        background: "rgba(255,255,255,0.03)",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      {c.has_logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/companies/${c.id}/logo`}
                          alt=""
                          width={44}
                          height={44}
                          style={{ objectFit: "cover" }}
                        />
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                      )}
                    </div>
                  </td>
                  <td>{highlight(c.ref_id, q.trim())}</td>
                  <td style={{ fontWeight: 650 }}>{highlight(c.name, q.trim())}</td>
                  <td>{c.industry ? highlight(c.industry, q.trim()) : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                  <td>
                    {c.website ? (
                      <a href={c.website} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                        {c.website}
                      </a>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                  <td>
                    <Link className="btn" href={`/companies/${c.id}`}>
                      {canEdit ? "Edit" : "View"}
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>
          {data ? `Total: ${data.total}` : ""}
        </span>
        <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Prev
        </button>
        <span className="badge">
          Page {page} / {totalPages}
        </span>
        <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
          Next
        </button>
      </div>

      <div className="notice">
        <strong>Note:</strong> Search activates after 2 characters. Logos must be PNG/JPEG and ≤200KB.
      </div>
    </div>
  );
}
