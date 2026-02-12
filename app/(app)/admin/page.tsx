"use client";

import { useState } from "react";

type Role = "ADMIN" | "OPS" | "CLIENT";

export default function AdminPage() {
  // Create user
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("CLIENT");
  const [displayName, setDisplayName] = useState("");
  const [companyRefs, setCompanyRefs] = useState(""); // comma separated e.g. KMP001,KMP002
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Reset password
  const [resetUserId, setResetUserId] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [busyReset, setBusyReset] = useState(false);
  const [resultReset, setResultReset] = useState<{ ok: boolean; msg: string } | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);

    const company_ref_ids = companyRefs
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          role,
          display_name: displayName || null,
          company_ref_ids: company_ref_ids.length ? company_ref_ids : undefined
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);

      setResult({ ok: true, msg: `Created user ${data.user.email} (${data.role})` });
      setEmail("");
      setPassword("");
      setDisplayName("");
      setCompanyRefs("");
      setRole("CLIENT");
    } catch (err: any) {
      setResult({ ok: false, msg: err?.message ?? "Failed" });
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault();
    setBusyReset(true);
    setResultReset(null);

    try {
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: resetUserId, new_password: resetPassword })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);

      setResultReset({ ok: true, msg: `Password reset for ${data.user.email}` });
      setResetUserId("");
      setResetPassword("");
    } catch (err: any) {
      setResultReset({ ok: false, msg: err?.message ?? "Failed" });
    } finally {
      setBusyReset(false);
    }
  }

  return (
    <div style={{ padding: 18 }}>
      <div className="notice" style={{ marginBottom: 12 }}>
        First admin must be bootstrapped in Supabase Dashboard once. After that, use this screen.
      </div>

      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Create user</div>

          {result ? (
            <div className={`notice ${result.ok ? "" : "bad"}`} style={{ marginBottom: 12 }}>
              {result.msg}
            </div>
          ) : null}

          <form onSubmit={onCreate} className="grid" style={{ gap: 10 }}>
            <label>
              <div style={{ marginBottom: 6, color: "var(--muted)", fontSize: 13 }}>Display name (optional)</div>
              <input
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jean Schaak"
              />
            </label>

            <label>
              <div style={{ marginBottom: 6, color: "var(--muted)", fontSize: 13 }}>Email</div>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </label>

            <label>
              <div style={{ marginBottom: 6, color: "var(--muted)", fontSize: 13 }}>Temporary password</div>
              <input
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
              />
            </label>

            <label>
              <div style={{ marginBottom: 6, color: "var(--muted)", fontSize: 13 }}>Role</div>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="CLIENT">CLIENT</option>
                <option value="OPS">OPS</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </label>

            <label>
              <div style={{ marginBottom: 6, color: "var(--muted)", fontSize: 13 }}>
                Assign company access (optional, Ref IDs, comma separated)
              </div>
              <input
                className="input"
                value={companyRefs}
                onChange={(e) => setCompanyRefs(e.target.value)}
                placeholder="KMP001,KMP002"
              />
            </label>

            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Creating..." : "Create user"}
            </button>
          </form>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Reset password (Admin-only in MVP)</div>

          {resultReset ? (
            <div className={`notice ${resultReset.ok ? "" : "bad"}`} style={{ marginBottom: 12 }}>
              {resultReset.msg}
            </div>
          ) : null}

          <form onSubmit={onReset} className="grid" style={{ gap: 10 }}>
            <label>
              <div style={{ marginBottom: 6, color: "var(--muted)", fontSize: 13 }}>User UUID</div>
              <input
                className="input"
                value={resetUserId}
                onChange={(e) => setResetUserId(e.target.value)}
                placeholder="e.g. 6aa5d0d4-2a9f-4483-b6c8-0cf4c6c98ac4"
                required
              />
            </label>

            <label>
              <div style={{ marginBottom: 6, color: "var(--muted)", fontSize: 13 }}>New password</div>
              <input
                className="input"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                type="password"
                required
              />
            </label>

            <button className="btn" type="submit" disabled={busyReset}>
              {busyReset ? "Resetting..." : "Reset password"}
            </button>

            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              For MVP simplicity, you copy the User UUID from Supabase Auth → Users.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
