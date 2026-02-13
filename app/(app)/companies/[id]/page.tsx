import Topbar from "@/components/Topbar";
import { requireUser } from "@/lib/auth";
import CompanyForm from "../_components/CompanyForm";

export default async function CompanyDetailsPage({ params }: { params: { id: string } }) {
  const { role } = await requireUser();

  return (
    <div className="container">
      <div className="card">
        <Topbar
          title={role === "CLIENT" ? "Company" : "Edit company"}
          subtitle={role === "CLIENT" ? "Read-only company profile" : "Update company profile"}
          right={<span className="badge">Phase 1</span>}
        />
        <div style={{ padding: 18 }}>
          <CompanyForm mode="edit" companyId={params.id} role={role} />
        </div>
      </div>
    </div>
  );
}
