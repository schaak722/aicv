import CompanyForm from "../_components/CompanyForm";
import { requireUser } from "@/lib/auth";

export default async function CompanyEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); // redirects if not logged in
  const { id } = await params;

  return (
    <div className="container">
      <div className="card">
        <div className="topbar">
          <div>
            <h1 className="h1">Edit Company</h1>
            <div className="sub">Update company profile</div>
          </div>
        </div>

        <div style={{ padding: 18 }}>
          <CompanyForm mode="edit" role={user.role} companyId={id} />
        </div>
      </div>
    </div>
  );
}
