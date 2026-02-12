import Topbar from "@/components/Topbar";

export default function Page() {
  return (
    <div className="container">
      <div className="card">
        <Topbar title="Applicants" subtitle="Global applicant list (includes Company + Position Title) with search and filters." right={<span className="badge">Placeholder</span>} />
        <div style={{ padding: 18 }}>
          <div className="notice" style={{ marginBottom: 12 }}>
            This screen is intentionally scaffolded in Phase 0.
          </div>
          <ul style={{ color: "var(--muted)", lineHeight: 1.7 }}>
            <li>Phase 2 will implement Applicants API + table with match score + recommendation.</li>
            <li>Search is substring contains (case-insensitive), starts at 2 characters; no fuzzy.</li>
            <li>Stars are per company, attached to an application.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
