import Topbar from "@/components/Topbar";

export default function Page() {
  return (
    <div className="container">
      <div className="card">
        <Topbar title="Companies" subtitle="Create and manage company profiles (Ref ID, Name, Logo, Description, Industry, Website)." right={<span className="badge">Placeholder</span>} />
        <div style={{ padding: 18 }}>
          <div className="notice" style={{ marginBottom: 12 }}>
            This screen is intentionally scaffolded in Phase 0.
          </div>
          <ul style={{ color: "var(--muted)", lineHeight: 1.7 }}>
            <li>Phase 1 will implement Companies API + list + create/edit forms.</li>
            <li>Logo stored in Postgres BYTEA; server resizes to 70×70.</li>
            <li>Ref ID format enforced: AAA000 (e.g., KMP001).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
