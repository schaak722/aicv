import Topbar from "@/components/Topbar";
import { requireRole, requireUser } from "@/lib/auth";
import CompanyForm from "../_components/CompanyForm";

export default async function NewCompanyPage() {
  const { role } = await requireUser();
  requireRole("OPS", role);

  return (
    <div className="container">
      <div className="card">
        <Topbar title="New company" subtitle="Create a company profile" right={<span className="badge">Phase 1</span>} />
        <div style={{ padding: 18 }}>
          <CompanyForm mode="create" role={role} />
        </div>
      </div>
    </div>
  );
}
