"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AppRole = "ADMIN" | "OPS" | "CLIENT";

type CompanyOption = { id: string; ref_id: string; name: string };

type JobRow = {
  id: string;
  job_ref: string | null;
  position_title: string;
  company_id: string;
  company_name: string;
  company_ref_id: string;
  location: string | null;
  seniority: "SENIOR" | "MID_LEVEL" | "JUNIOR_ENTRY";
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
};

type ApiResponse = {
  items: JobRow[];
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
  return `${before}__H__${mid}__H__${after}`;
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function renderHighlighted(h: string) {
  const safe = h
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  const html = safe
    .replaceAll("__H__", "<mark>")
    .replace("</mark><mark>", "")
    .replaceAll(
      "<mark>",
      '<mark style="background:rgba(91,140,255,0.25); color:inherit; padding:0 2px; border-radius:4px;">'
    )
    .replaceAll("</mark>", "</mark>");

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function JobsClient({ role }: { role: AppRole }) {
  const canEdit = role !== "CLIENT";

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [companyId, setCompanyId] = useState<string>("");

  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<JobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    let cancelled = false;

    async function loadCompanies() {
      try {
        const res = await fetch("/api/companies/options", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load companies");
        if (!cancelled) setCompanyOptions(json?.items ?? []);
      } catch {
        if (!cancelled) setCompanyOptions([]);
      }
    }

    loadCompanies();

    return () => {
      cancelled = true;
    };
  }, []);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (status !== "ALL") sp.set("status", status);
    if (companyId) sp.set("companyId", companyId);
    sp.set("page", String(page));
    sp.set("pageSize", String(pageSize));
    sp.set("sort", "updated_at");
    sp.set("dir", "desc");
    return sp.toString();
  }, [q, status, companyId, page]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/jobs?${queryString}`, { cache: "no-store" });
        const json: ApiResponse = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load jobs");
        if (!cancelled) {
          setItems(json.items ?? []);
          setTotal(json.total ?? 0);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [queryString]);

  // Reset to page 1 if filters/search changed
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, companyId]);

  const rows = useMemo(() => {
    return items.map((r) => ({
      ...r,
      _companyNameHighlighted: highlight(`${r.company_ref_id} • ${r.company_name}`, q),
      _titleHighlighted: highlight(r.position_title, q)
    }));
  }, [items, q]);

  return (
    <div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 180px 240px auto", alignItems: "end" }}>
        <div>
          <div className="label">Search</div>
          <input
            className="input"
            placeholder="Position title, job ref..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div>
          <div className="label">Status</div>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div>
          <div className="label">Company</div>
          <select className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">All companies</option>
            {companyOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.ref_id} • {c.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {canEdit ? (
            <Link className="btn primary" href="/jobs/new">
              + New Job
            </Link>
          ) : null}
        </div>
      </div>

      {err ? <div className="notice" style={{ marginTop: 12 }}>{err}</div> : null}
      {loading ? <div className="sub" style={{ marginTop: 12 }}>Loading...</div> : null}

      <div style={{ marginTop: 12, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Position</th>
              <th>Status</th>
              <th>Updated</th>
              <th style={{ width: 120 }} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="sub">
                  No jobs found.
                </td>
              </tr>
            ) : null}

            {rows.map((r) => (
              <tr key={r.id}>
                <td>{renderHighlighted(r._companyNameHighlighted)}</td>

                <td>
                  {renderHighlighted(r._titleHighlighted)}
                  {r.job_ref ? <div className="sub">Ref: {r.job_ref}</div> : null}
                  {r.location ? <div className="sub">{r.location}</div> : null}
                </td>

                <td>
                  <span className={`pill ${r.status === "ACTIVE" ? "good" : "warn"}`}>{r.status}</span>
                </td>

                <td className="sub">{fmtDate(r.updated_at)}</td>

                <td style={{ textAlign: "right" }}>
                  <Link className="btn" href={`/jobs/${r.id}`}>
                    {role === "CLIENT" ? "View" : "Open"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
        <div className="sub">
          Page {page} of {totalPages} • {total} total
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Prev
          </button>
          <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
