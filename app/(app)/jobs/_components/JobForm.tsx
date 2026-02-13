"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AppRole = "ADMIN" | "OPS" | "CLIENT";

type JobStatus = "ACTIVE" | "INACTIVE";

type CompanyOption = {
  id: string;
  name: string;
  ref_id: string;
};

type Job = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  basis: string | null;
  seniority: string | null;
  salary_band: string | null;
  status: JobStatus;
  updated_at: string;
};

type Props =
  | { mode: "create"; role: AppRole }
  | { mode: "edit"; role: AppRole; jobId: string };

export default function JobForm(props: Props) {
  const router = useRouter();

  const readOnly = props.role === "CLIENT";

  // ✅ Make jobId stable & safe for TS
  const jobId = props.mode === "edit" ? props.jobId : null;

  const [loading, setLoading] = useState(props.mode === "edit");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [basis, setBasis] = useState("");
  const [seniority, setSeniority] = useState("");
  const [salaryBand, setSalaryBand] = useState("");
  const [status, setStatus] = useState<JobStatus>("ACTIVE");

  const canEditStatus = props.role === "ADMIN" || props.role === "OPS";

  const statusBadge = useMemo(() => {
    return status === "ACTIVE" ? "badge" : "badge";
  }, [status]);

  // Load company dropdown options
  useEffect(() => {
    let cancelled = false;

    async function loadCompanies() {
      try {
        const res = await fetch("/api/companies/options", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load companies");
        if (!cancelled) setCompanies(json.options ?? []);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load companies");
      }
    }

    loadCompanies();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load job when edit
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
        setTitle(j.title);
        setDescription(j.description ?? "");
        setBasis(j.basis ?? "");
        setSeniority(j.seniority ?? "");
        setSalaryBand(j.salary_band ?? "");
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
      const payload = {
        company_id: companyId,
        title: title.trim(),
        description: description.trim() || null,
        basis: basis.trim() || null,
        seniority: seniority.trim() || null,
        salary_band: salaryBand.trim() || null,
        status: canEditStatus ? status : undefined,
      };

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
        <div>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>Company</label>
          <select
            className="input"
            value={companyId}
            disabled={readOnly || props.mode === "edit"} /* lock company on edit */
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">Select a company…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.ref_id} — {c.name}
              </option>
            ))}
          </select>
          <small>{props.mode === "edit" ? "Company cannot be changed after creation." : "Select the company for this job."}</small>
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
          <input className="input" value={basis} disabled={readOnly} onChange={(e) => setBasis(e.target.value)} placeholder="Full-Time" />
        </div>

        <div>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>Seniority</label>
          <input className="input" value={seniority} disabled={readOnly} onChange={(e) => setSeniority(e.target.value)} placeholder="Mid Level" />
        </div>

        <div>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>Salary band</label>
          <input className="input" value={salaryBand} disabled={readOnly} onChange={(e) => setSalaryBand(e.target.value)} placeholder="€30,000 - €45,000" />
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
