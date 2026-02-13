"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AppRole = "ADMIN" | "OPS" | "CLIENT";

type Company = {
  id: string;
  ref_id: string;
  name: string;
  industry: string | null;
  website: string | null;
  description: string | null;
  has_logo: boolean;
};

type Props =
  | { mode: "create"; role: AppRole }
  | { mode: "edit"; role: AppRole; companyId: string };

function isValidRefId(ref: string) {
  return /^[A-Z]{3}[0-9]{3}$/.test(ref);
}

export default function CompanyForm(props: Props) {
  const router = useRouter();

  const readOnly = props.role === "CLIENT";
  const canEdit = props.role !== "CLIENT";

  const [loading, setLoading] = useState(props.mode === "edit");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [id, setId] = useState<string | null>(props.mode === "edit" ? props.companyId : null);

  const [refId, setRefId] = useState("");
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");

  const [hasLogo, setHasLogo] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  const logoPreviewUrl = useMemo(() => {
    if (logoFile) return URL.createObjectURL(logoFile);
    if (props.mode === "edit" && id && hasLogo && !removeLogo) return `/api/companies/${id}/logo`;
    return null;
  }, [logoFile, props.mode, id, hasLogo, removeLogo]);

  useEffect(() => {
    return () => {
      if (logoFile) URL.revokeObjectURL(logoPreviewUrl || "");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoFile]);

  useEffect(() => {
    if (props.mode !== "edit") return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/companies/${props.companyId}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load company");

        const c: Company = json.company;

        if (cancelled) return;

        setId(c.id);
        setRefId(c.ref_id);
        setName(c.name);
        setIndustry(c.industry ?? "");
        setWebsite(c.website ?? "");
        setDescription(c.description ?? "");
        setHasLogo(Boolean(c.has_logo));
        setRemoveLogo(false);
        setLogoFile(null);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load company");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [props]);

  async function onSave() {
    setErr(null);
    setOkMsg(null);

    const rid = refId.trim().toUpperCase();
    if (!isValidRefId(rid)) {
      setErr("Ref ID must be AAA000 (e.g., KMP001)");
      return;
    }
    if (name.trim().length < 2) {
      setErr("Name is required (min 2 characters)");
      return;
    }

    const fd = new FormData();
    fd.append("ref_id", rid);
    fd.append("name", name.trim());
    fd.append("industry", industry.trim());
    fd.append("website", website.trim());
    fd.append("description", description.trim());
    fd.append("remove_logo", removeLogo ? "1" : "0");
    if (logoFile) fd.append("logo", logoFile);

    setSaving(true);

    try {
      const url = props.mode === "create" ? "/api/companies" : `/api/companies/${props.companyId}`;
      const method = props.mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, { method, body: fd });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || "Save failed");

      if (props.mode === "create") {
        const companyId = json?.company?.id;
        setOkMsg("Company created.");
        if (companyId) {
          router.push(`/companies/${companyId}`);
          router.refresh();
          return;
        }
        router.push("/companies");
        router.refresh();
      } else {
        setOkMsg("Saved.");
        setLogoFile(null);
        setRemoveLogo(false);
        // Force logo refresh
        setHasLogo(!removeLogo || Boolean(logoFile));
        router.refresh();
      }
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ color: "var(--muted)" }}>Loading…</div>;
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      {err && <div className="notice bad">{err}</div>}
      {okMsg && <div className="notice">{okMsg}</div>}

      <div className="grid cols-2">
        <div>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>Ref ID (Unique)</label>
          <input
            className="input"
            value={refId}
            disabled={readOnly}
            onChange={(e) => setRefId(e.target.value.toUpperCase())}
            placeholder="KMP001"
          />
          <small>Format: 3 letters + 3 digits (AAA000)</small>
        </div>

        <div>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>Company name</label>
          <input className="input" value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>Industry</label>
          <input className="input" value={industry} disabled={readOnly} onChange={(e) => setIndustry(e.target.value)} />
        </div>

        <div>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>Website</label>
          <input
            className="input"
            value={website}
            disabled={readOnly}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
          />
        </div>
      </div>

      <div>
        <label style={{ fontSize: 13, color: "var(--muted)" }}>Company description</label>
        <textarea
          className="input"
          value={description}
          disabled={readOnly}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          style={{ resize: "vertical" }}
        />
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Logo</div>
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: 14,
                border: "1px solid var(--line)",
                background: "rgba(255,255,255,0.03)",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              {logoPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreviewUrl} alt="" width={70} height={70} style={{ objectFit: "cover" }} />
              ) : (
                <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
              )}
            </div>
          </div>

          <div style={{ minWidth: 280 }}>
            <div className="notice" style={{ marginBottom: 10 }}>
              PNG/JPEG only • ≤200KB • Displayed as 70×70
            </div>

            {canEdit && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  disabled={saving}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setLogoFile(f);
                    setRemoveLogo(false);
                  }}
                />

                {props.mode === "edit" && hasLogo && (
                  <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--muted)" }}>
                    <input
                      type="checkbox"
                      checked={removeLogo}
                      disabled={saving}
                      onChange={(e) => {
                        setRemoveLogo(e.target.checked);
                        if (e.target.checked) setLogoFile(null);
                      }}
                    />
                    Remove existing logo
                  </label>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn" onClick={() => router.push("/companies")}>
          Back
        </button>

        {canEdit && (
          <button className="btn primary" disabled={saving} onClick={onSave}>
            {saving ? "Saving…" : props.mode === "create" ? "Create company" : "Save changes"}
          </button>
        )}
      </div>
    </div>
  );
}
