import Topbar from "@/components/Topbar";
import { requireUser } from "@/lib/auth";

export default async function DashboardPage() {
  const { displayName, role } = await requireUser();

  return (
    <div className="container">
      <div className="card">
        <Topbar
          title="Dashboard"
          subtitle={`Welcome, ${displayName} • Role: ${role}`}
          right={<span className="badge">Phase 0</span>}
        />
        <div style={{ padding: 18 }}>
          <div className="grid cols-3">
            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>Companies</div>
              <div style={{ fontSize: 26, fontWeight: 750, marginTop: 6 }}>—</div>
              <small>Phase 1 will wire this up</small>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>Active jobs</div>
              <div style={{ fontSize: 26, fontWeight: 750, marginTop: 6 }}>—</div>
              <small>Phase 1</small>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>Applicants</div>
              <div style={{ fontSize: 26, fontWeight: 750, marginTop: 6 }}>—</div>
              <small>Phase 2</small>
            </div>
          </div>

          <div style={{ marginTop: 14 }} className="notice">
            <strong style={{ color: "var(--text)" }}>You are live.</strong>{" "}
            Next steps: connect Companies CRUD + logo upload (stored in Postgres BYTEA) and Jobs CRUD.
          </div>
        </div>
      </div>
    </div>
  );
}
