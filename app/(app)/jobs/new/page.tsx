import Link from "next/link";
import Topbar from "@/components/Topbar";
import { requireUser } from "@/lib/auth";
import JobForm from "../_components/JobForm";

export default async function NewJobPage() {
  const { role } = await requireUser();

  return (
    <div className="container">
      <div className="card">
        <Topbar
          title="New Job"
          subtitle="Create a job linked to a Company profile"
          right={
            <Link className="btn" href="/jobs">
              Back to Jobs
            </Link>
          }
        />
        <div style={{ padding: 18 }}>
          <JobForm mode="create" role={role} />
        </div>
      </div>
    </div>
  );
}
