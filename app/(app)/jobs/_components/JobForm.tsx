"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AppRole = "ADMIN" | "OPS" | "CLIENT";

type CompanyOption = { id: string; ref_id: string; name: string };

type Job = {
  id: string;
  job_ref: string | null;
  company_id: string;
  company_name: string;
  company_ref_id: string;
  position_title: string;
  job_description: string;
  location: string | null;
  job_basis: string[];
  salary_bands: string[];
  seniority: "SENIOR" | "MID_LEVEL" | "JUNIOR_ENTRY";
  categories: string[];
  status: "ACTIVE" | "INACTIVE";
  inactivated_reason: string | null;
  inactivated_at: string | null;
  created_at: string;
  updated_at: string;
};

type Props =
  | { mode: "create"; role: AppRole }
  | { mode: "edit"; role: AppRole; jobId: string };

const JOB_BASIS_OPTIONS: Array<[string, string]> = [["FULL_TIME", "Full-Time"], ["PART_TIME", "Part-Time"], ["FREELANCE", "Freelance"], ["HYBRID", "Hybrid"], ["TEMPORARY", "Temporary"]];
const SALARY_BANDS_OPTIONS: Array<[string, string]> = [["ANY", "Any"], ["EUR_11532_16000", "\u20ac11,532 - \u20ac16,000"], ["EUR_16000_20000", "\u20ac16,000 - \u20ac20,000"], ["EUR_20000_24000", "\u20ac20,000 - \u20ac24,000"], ["EUR_24000_30000", "\u20ac24,000 - \u20ac30,000"], ["EUR_30000_45000", "\u20ac30,000 - \u20ac45,000"], ["EUR_45000_60000", "\u20ac45,000 - \u20ac60,000"], ["EUR_60000_80000", "\u20ac60,000 - \u20ac80,000"], ["EUR_80000_OR_MORE", "\u20ac80,000 or more"]];
const SENIORITY_OPTIONS: Array<[string, string]> = [["JUNIOR_ENTRY", "Entry Level"], ["MID_LEVEL", "Mid Level"], ["SENIOR", "Senior Level"]];
const DEFAULT_CATEGORIES: string[] = ["Accounting", "IT", "Sales", "Marketing", "Operations"];

function fmtDate(iso: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function JobForm(props: Props) {
  const router = useRouter();

  const readOnly = props.role === "CLIENT";
  const canEdit = props.role !== "CLIENT";

  const [loading, setLoading] = useState(props.mode === "edit");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);

  const [companyId, setCompanyId] = useState<string>("");
  const [jobRef, setJobRef] = useState<string>("");
  const [positionTitle, setPositionTitle] = useState<string>("");
  const [jobDescription, setJobDescription] = useState<string>("");
  const [location, setLocation] = useState<string>("");

  const [jobBasis, setJobBasis] = useState<string[]>([]);
  const [salaryBands, setSalaryBands] = useState<string[]>([]);
  const [seniority, setSeniority] = useState<"SENIOR" | "MID_LEVEL" | "JUNIOR_ENTRY">("MID_LEVEL");
  const [categories, setCategories] = useState<string[]>([]);

  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [inactivatedReason, setInactivatedReason] = useState<string>("");

  const [metaCreatedAt, setMetaCreatedAt] = useState<string | null>(null);
  const [metaUpdatedAt, setMetaUpdatedAt] = useState<string | null>(null);
  const [metaInactivatedAt, setMetaInactivatedAt] = useState<string | null>(null);

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

  useEffect(() => {
    if (props.mode !== "edit") {
      // defaults for create
      setCategories(DEFAULT_CATEGORIES.slice(0, 2));
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/jobs/${props.jobId}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load job");

        const job: Job = json.job;

        if (!cancelled) {
          setCompanyId(job.company_id);
          setJobRef(job.job_ref ?? "");
          setPositionTitle(job.position_title);
          setJobDescription(job.job_description);
          setLocation(job.location ?? "");

          setJobBasis(job.job_basis ?? []);
          setSalaryBands(job.salary_bands ?? []);
          setSeniority(job.seniority);
          setCategories(job.categories ?? []);

          setStatus(job.status);
          setInactivatedReason(job.inactivated_reason ?? "");

          setMetaCreatedAt(job.created_at);
          setMetaUpdatedAt(job.updated_at);
          setMetaInactivatedAt(job.inactivated_at);
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
  }, [props]);

  const companyLabel = useMemo(() => {
    const c = companyOptions.find((x) => x.id === companyId);
    return c ? `${c.ref_id} • ${c.name}` : "";
  }, [companyOptions, companyId]);

  function toggleArrayValue(arr: string[], value: string) {
    if (arr.includes(value)) return arr.filter((x) => x !== value);
    return [...arr, value];
  }

  async function save(desiredStatus?: "ACTIVE" | "INACTIVE") {
    if (!canEdit) return;

    setSaving(true);
    setErr(null);
    setOkMsg(null);

    try {
      const finalStatus = desiredStatus ?? status;

      if (!companyId) throw new Error("Please select a Company");
      if (positionTitle.trim().length < 2) throw new Error("Position Title is required");
      if (jobDescription.trim().length < 20) throw new Error("Job Description must be at least 20 characters");
      if (!seniority) throw new Error("Seniority is required");

      if (finalStatus === "INACTIVE" && inactivatedReason.trim().length < 3) {
        throw new Error("Inactivation reason is required (min 3 characters)");
      }

      const payload = {
        company_id: companyId,
        job_ref: jobRef.trim() || null,
        position_title: positionTitle.trim(),
        job_description: jobDescription.trim(),
        location: location.trim() || null,
        job_basis: jobBasis,
        salary_bands: salaryBands,
        seniority,
        categories,
        status: finalStatus,
        inactivated_reason: finalStatus === "INACTIVE" ? inactivatedReason.trim() : null
      };

      const url = props.mode === "create" ? "/api/jobs" : `/api/jobs/${props.jobId}`;
      const method = props.mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Save failed");

      setOkMsg(props.mode === "create" ? "Job created." : "Saved.");

      if (props.mode === "create") {
        const newId = json?.job?.id;
        if (newId) {
          router.push(`/jobs/${newId}`);
          router.refresh();
        } else {
          router.push("/jobs");
          router.refresh();
        }
      } else {
        setStatus(finalStatus);
        router.refresh();
      }
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {err ? <div className="notice" style={{ marginBottom: 12 }}>{err}</div> : null}
      {okMsg ? <div className="notice good" style={{ marginBottom: 12 }}>{okMsg}</div> : null}

      {loading ? <div className="sub">Loading...</div> : null}

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        <div>
          <div className="label">Company</div>
          <select
            className="input"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            disabled={readOnly || props.mode === "edit"}
          >
            <option value="">{props.role === "CLIENT" ? "Your companies" : "Select a company"}</option>
            {companyOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.ref_id} • {c.name}
              </option>
            ))}
          </select>
          {props.mode === "edit" ? <div className="sub">Company: {companyLabel}</div> : null}
        </div>

        <div>
          <div className="label">Job Ref (optional)</div>
          <input className="input" value={jobRef} onChange={(e) => setJobRef(e.target.value)} disabled={readOnly} />
          <div className="sub">Internal reference if you use one (optional).</div>
        </div>

        <div>
          <div className="label">Position Title</div>
          <input className="input" value={positionTitle} onChange={(e) => setPositionTitle(e.target.value)} disabled={readOnly} />
        </div>

        <div>
          <div className="label">Location (optional)</div>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} disabled={readOnly} />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <div className="label">Job Description</div>
          <textarea
            className="input"
            style={{ minHeight: 160 }}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            disabled={readOnly}
          />
          <div className="sub">Minimum 20 characters. Plain text for MVP.</div>
        </div>

        <div>
          <div className="label">Seniority</div>
          <select className="input" value={seniority} onChange={(e) => setSeniority(e.target.value as any)} disabled={readOnly}>
            {SENIORITY_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="label">Categories</div>
          <div className="sub" style={{ marginBottom: 8 }}>
            Sample list for now (you will provide the real list later).
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {DEFAULT_CATEGORIES.map((c) => (
              <label key={c} className="btn" style={{ justifyContent: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={categories.includes(c)}
                  onChange={() => setCategories((prev) => toggleArrayValue(prev, c))}
                  disabled={readOnly}
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="label">Job Basis</div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {JOB_BASIS_OPTIONS.map(([v, label]) => (
              <label key={v} className="btn" style={{ justifyContent: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={jobBasis.includes(v)}
                  onChange={() => setJobBasis((prev) => toggleArrayValue(prev, v))}
                  disabled={readOnly}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="label" style={{ marginTop: 12 }}>Salary Bands</div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {SALARY_BANDS_OPTIONS.map(([v, label]) => (
              <label key={v} className="btn" style={{ justifyContent: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={salaryBands.includes(v)}
                  onChange={() => setSalaryBands((prev) => toggleArrayValue(prev, v))}
                  disabled={readOnly}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <div className="hr" style={{ margin: "12px 0" }} />
        </div>

        <div>
          <div className="label">Status</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className={`pill ${status === "ACTIVE" ? "good" : "warn"}`}>{status}</span>
            {props.mode === "edit" ? (
              <span className="sub">
                {status === "ACTIVE"
                  ? "Auto-inactive after 60 days of inactivity (based on updated date)."
                  : `Inactive since: ${fmtDate(metaInactivatedAt)}`}
              </span>
            ) : null}
          </div>

          {status === "INACTIVE" ? (
            <div style={{ marginTop: 10 }}>
              <div className="label">Inactivation reason</div>
              <input
                className="input"
                value={inactivatedReason}
                onChange={(e) => setInactivatedReason(e.target.value)}
                disabled={readOnly}
                placeholder="e.g. Job filled, on hold, cancelled..."
              />
            </div>
          ) : null}

          {props.mode === "edit" && canEdit ? (
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              {status === "ACTIVE" ? (
                <button className="btn warn" disabled={saving} onClick={() => save("INACTIVE")}>
                  Deactivate
                </button>
              ) : (
                <button className="btn good" disabled={saving} onClick={() => save("ACTIVE")}>
                  Activate
                </button>
              )}
            </div>
          ) : null}
        </div>

        <div>
          <div className="label">Metadata</div>
          <div className="sub">Created: {fmtDate(metaCreatedAt)}</div>
          <div className="sub">Updated: {fmtDate(metaUpdatedAt)}</div>
          <div className="sub" style={{ marginTop: 10 }}>
            Applicants: <span className="badge">Coming soon (Phase 3)</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        {canEdit ? (
          <button className="btn primary" disabled={saving || loading} onClick={() => save()}>
            {saving ? "Saving..." : props.mode === "create" ? "Create Job" : "Save changes"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
