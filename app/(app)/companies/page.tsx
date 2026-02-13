import Topbar from "@/components/Topbar";
import { requireUser } from "@/lib/auth";
import CompaniesClient from "./_components/CompaniesClient";

export default async function CompaniesPage() {
  const { role } = await requireUser();

  return (
    <div className="container">
      <div className="card">
        <Topbar
          title="Companies"
          subtitle={role === "CLIENT" ? "Your assigned companies" : "Manage company profiles"}
          right={<span className="badge">Phase 1</span>}
        />
        <div style={{ padding: 18 }}>
          <CompaniesClient role={role} />
        </div>
      </div>
    </div>
  );
}
