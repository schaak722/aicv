import Link from "next/link";
import Topbar from "@/components/Topbar";
import { requireUser } from "@/lib/auth";
import JobForm from "../_components/JobForm";

export default async function JobDetailsPage({ params }: { params: { id: string } }) {
  const { role } = await requireUser();

  return (
    <div className="container">
      <div className="card">
        <Topbar
          title="Job"
          subtitle="View / edit job details"
          right={
            <Link className="btn" href="/jobs">
              Back to Jobs
            </Link>
          }
        />
        <div style={{ padding: 18 }}>
          <JobForm mode="edit" role={role} jobId={params.id} />
        </div>
      </div>
    </div>
  );
}
