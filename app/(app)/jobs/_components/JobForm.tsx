"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type AppRole = "ADMIN" | "OPS" | "CLIENT";
type JobStatus = "ACTIVE" | "INACTIVE";

type CompanyOption = { id: string; ref_id: string; name: string };

type Job = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  basis: string | null;
  seniority: string | null;
  salary_band: string | null;
  status: JobStatus;
};

type Props =
  | { mode: "create"; role: AppRole }
  | { mode: "edit"; role: AppRole; jobId: string };

const BASIS = ["Full-Time", "Part-Time", "Freelance", "Hybrid", "Temporary"];
const SENIORITY = ["Entry Level", "Mid Level", "Senior Level"];
const SALARY_BANDS = [
  "Any",
  "€11,532 - €16,000",
  "€16,000 - €20,000",
  "€20,000 - €24,000",
  "€24,000 - €30,000",
  "€30,000 - €45,000",
  "€45,000 - €60,000",
  "€60,000 - €80,000",
  "€80,000 or more",
];

export default function JobForm(props: Props) {
  const router = useRouter();
  const readOnly = props.role === "CLIENT";
  const canEditStatus = props.role === "ADMIN" || props.role === "OPS";
  const jobId = props.mode === "edit" ? props.jobId : null;

  const [loading, setLoading] = useState(props.mode === "edit");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // company selection (typeahead)
  const [companyId, setCompanyId] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [companyOpen, setCompanyOpen] = useState(false);
  const companyBoxRef = useRef<HTMLDivElement | null>(null);

  // job fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [basis, setBasis] = useState(BASIS[0]);
  const [seniority, setSeniority] = useState(SENIORITY[1]);
  const [salaryBand, setSalaryBand] = useState(SALARY_BANDS[0]);
  const [status, setStatus] = useState<JobStatus>("ACTIVE");

  // Close dropdown on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!companyBoxRef.current) return;
      if (!companyBoxRef.current.contains(e.target as Node)) setCompanyOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Search companies as user types
  useEffect(() => {
    let cancelled = false;

    async function searchCompanies() {
      const q = companyQuery.trim();
      if (!q) {
        setCompanyOptions([]);
        return;
      }

      try {
        const res = await fetch(`/api/companies/options?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to search companies");
        if (!cancelled) setCompanyOptions(json.options ?? []);
      } catch {
        if (!cancelled) setCompanyOptions([]);
      }
    }

    const t = setTimeout(searchCompanies, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [companyQuery]);

  // Load job in edit mode
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    async function loadJob() {
      setLoading(true);
      setErr(null);

      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load job");

        const j: Job = json.job;

        if (cancelled) return;

        setCompanyId(j.company_id);
        // We don’t necessarily know the company name here; user can leave it locked on edit.
        setTitle(j.title);
        setDescription(j.description ?? "");
        setBasis(j.basis ?? BASIS[0]);
        setSeniority(j.seniority ?? SENIORITY[1]);
        setSalaryBand(j.salary_band ?? SALARY_BANDS[0]);
        setStatus(j.status);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load job");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadJob();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const companyLabel = useMemo(() => {
    if (!companyId) return "";
    const found = companyOptions.find((c) => c.id === companyId);
    return found ? `${found.ref_id} — ${found.name}` : "";
  }, [companyId, companyOptions]);

  async function onSave() {
    setErr(null);
    setOkMsg(null);

    if (readOnly) {
      setErr("You do not have permission to edit jobs.");
      return;
    }

    if (!companyId) {
      setErr("Company is required.");
      return;
    }
    if (title.trim().length < 2) {
      setErr("Title is required (min 2 characters).");
      return;
    }

    setSaving(true);

    try {
      const payload: any = {
        company_id: companyId,
        title: title.trim(),
        description: description.trim() || null,
        basis,
        seniority,
        salary_band: salaryBand,
      };
      if (canEditStatus) payload.status = status;

      const url = props.mode === "create" ? "/api/jobs" : `/api/jobs/${jobId ?? ""}`;
      const method = props.mode === "create" ? "POST" : "PUT";
      if (props.mode === "edit" && !jobId) throw new Error("Missing jobId for edit mode");

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || "Save failed");

      if (props.mode === "create") {
        const newId = json?.job?.id;
        setOkMsg("Job created.");
        if (newId) {
          router.push(`/jobs/${newId}`);
          router.refresh();
          return;
        }
        router.push("/jobs");
        router.refresh();
      } else {
        setOkMsg("Saved.");
        router.refresh();
      }
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

  return (
    <div className="grid" style={{ gap: 14 }}>
      {err && <div className="notice bad">{err}</div>}
      {okMsg && <div className="notice">{okMsg}</div>}

      <div className="grid cols-2">
        <div ref={companyBoxRef} style={{ position: "relative" }}>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>Company</label>

          {props.mode === "edit" ? (
            <input className="input" value={companyId} disabled readOnly />
          ) : (
            <>
              <input
                className="input"
                placeholder="Search company by name or Ref ID…"
                value={companyQuery}
                disabled={readOnly}
                onFocus={() => setCompanyOpen(true)}
                onChange={(e) => {
                  setCompanyQuery(e.target.value);
                  setCompanyOpen(true);
                }}
              />

              {companyOpen && companyQuery.trim() && (
                <div
                  style={{
                    position: "absolute",
                    top: 72,
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: "var(--panel)",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  {companyOptions.length === 0 && (
                    <div style={{ padding: 10, color: "var(--muted)" }}>No matches…</div>
                  )}

                  {companyOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="btn"
                      style={{
                        width: "100%",
                        justifyContent: "flex-start",
                        borderRadius: 0,
                        border: "none",
                        borderBottom: "1px solid var(--line)",
                        background: "transparent",
                      }}
                      onClick={() => {
                        setCompanyId(c.id);
                        setCompanyQuery(`${c.ref_id} — ${c.name}`);
                        setCompanyOpen(false);
                      }}
                    >
                      <strong>{c.ref_id}</strong>&nbsp;— {c.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <small>
            {props.mode === "edit"
              ? "Company cannot be changed after creation."
              : "Type to search, then click a company to select it."}
          </small>
        </div>

        <div>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>Status</label>
          <select
            className="input"
            value={status}
            disabled={readOnly || !canEditStatus}
            onChange={(e) => setStatus(e.target.value as JobStatus)}
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
          <small>{canEditStatus ? "Admins/Ops can change status." : "Status managed by Admin/Ops."}</small>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 13, color: "var(--muted)" }}>Job title</label>
        <input className="input" value={title} disabled={readOnly} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div>
        <label style={{ fontSize: 13, color: "var(--muted)" }}>Job description</label>
        <textarea
          className="input"
          value={description}
          disabled={readOnly}
          onChange={(e) => setDescription(e.target.value)}
          rows={8}
          style={{ resize: "vertical" }}
        />
      </div>

      <div className="grid cols-3">
        <div>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>Basis</label>
          <select className="input" value={basis} disabled={readOnly} onChange={(e) => setBasis(e.target.value)}>
            {BASIS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>Seniority</label>
          <select className="input" value={seniority} disabled={readOnly} onChange={(e) => setSeniority(e.target.value)}>
            {SENIORITY.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>Salary band</label>
          <select className="input" value={salaryBand} disabled={readOnly} onChange={(e) => setSalaryBand(e.target.value)}>
            {SALARY_BANDS.map((sb) => (
              <option key={sb} value={sb}>
                {sb}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {!readOnly && (
          <button className="btn primary" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : props.mode === "create" ? "Create job" : "Save changes"}
          </button>
        )}
        <button className="btn" onClick={() => router.push("/jobs")} disabled={saving}>
          Back
        </button>
      </div>
    </div>
  );
}
