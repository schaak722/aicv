import Topbar from "@/components/Topbar";
import { requireRole, requireUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireUser();
  requireRole("ADMIN", role);

  return (
    <div className="container">
      <div className="card">
        <Topbar title="Admin" subtitle="Invite-only user management (MVP)" right={<span className="badge">ADMIN</span>} />
        {children}
      </div>
    </div>
  );
}
