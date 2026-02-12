import Topbar from "@/components/Topbar";

export default function Page() {
  return (
    <div className="container">
      <div className="card">
        <Topbar title="Jobs" subtitle="Create jobs linked to a company; set basis, salary bands, seniority, categories." right={<span className="badge">Placeholder</span>} />
        <div style={{ padding: 18 }}>
          <div className="notice" style={{ marginBottom: 12 }}>
            This screen is intentionally scaffolded in Phase 0.
          </div>
          <ul style={{ color: "var(--muted)", lineHeight: 1.7 }}>
            <li>Phase 1 will implement Jobs API + list + create/edit forms.</li>
            <li>Job must be associated to an existing Company profile.</li>
            <li>Inactivation requires a reason; status tracked.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
