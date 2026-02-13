"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type AppRole = "ADMIN" | "OPS" | "CLIENT";

type CompanyRow = {
  id: string;
  ref_id: string;
  name: string;
  email: string | null;
  industry: string | null;
  website: string | null;
  derived_status?: "ACTIVE" | "INACTIVE"; // from API
};

export default function CompaniesClient({ role }: { role: AppRole }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "ACTIVE" | "INACTIVE">("");
  const [rows, setRows] = useState<CompanyRow[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("derived_status", status);

      const res = await fetch(`/api/companies?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load companies");
      setRows(json.companies ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load companies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((c) => (c.name ?? "").toLowerCase().includes(s) || (c.ref_id ?? "").toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      {err && <div className="notice bad">{err}</div>}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          className="input"
          placeholder="Search by name or Ref ID…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 420 }}
        />

        <select className="input" style={{ maxWidth: 200 }} value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="">All (derived)</option>
          <option value="ACTIVE">Active (has active job)</option>
          <option value="INACTIVE">Inactive (no active jobs)</option>
        </select>

        <button className="btn" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>

        {role !== "CLIENT" && (
          <Link className="btn primary" href="/companies/new">
            + New company
          </Link>
        )}
      </div>

      <div className="card" style={{ padding: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 54 }}></th>
              <th>Ref ID</th>
              <th>Company</th>
              <th>Email</th>
              <th>Industry</th>
              <th>Derived status</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  <img
                    src={`/api/companies/${c.id}/logo`}
                    alt=""
                    style={{ width: 28, height: 28, borderRadius: 8, objectFit: "cover", border: "1px solid var(--line)" }}
                    onError={(e) => {
                      // Hide broken image and keep layout stable
                      (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                    }}
                  />
                </td>

                <td>{c.ref_id}</td>
                <td style={{ fontWeight: 650 }}>{c.name}</td>
                <td>{c.email ?? "—"}</td>
                <td>{c.industry ?? "—"}</td>

                <td>
                  <span className="badge">{c.derived_status ?? "—"}</span>
                </td>

                <td style={{ textAlign: "right" }}>
                  <Link className="btn" href={`/companies/${c.id}`}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: "var(--muted)", padding: 14 }}>
                  No companies found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
