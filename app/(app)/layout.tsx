import Sidebar from "@/components/Sidebar";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireUser();
  const appName = process.env.APP_NAME ?? "Applicant Screening";

  return (
    <div className="shell">
      <Sidebar role={role} appName={appName} />
      <main className="content">{children}</main>
    </div>
  );
}
