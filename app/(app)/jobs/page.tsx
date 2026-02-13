import Topbar from "@/components/Topbar";
import { requireUser } from "@/lib/auth";
import JobsClient from "./_components/JobsClient";

export default async function JobsPage() {
  const { role } = await requireUser();

  return (
    <div className="container">
      <div className="card">
        <Topbar
          title="Jobs"
          subtitle={role === "CLIENT" ? "Your job history" : "Manage job lifecycle"}
          right={<span className="badge">Phase 2</span>}
        />
        <div style={{ padding: 18 }}>
          <JobsClient role={role} />
        </div>
      </div>
    </div>
  );
}
