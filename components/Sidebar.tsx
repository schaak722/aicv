"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppRole } from "@/lib/auth";

type NavItem = { href: string; label: string; minRole?: AppRole };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/companies", label: "Companies" },
  { href: "/jobs", label: "Jobs" },
  { href: "/applicants", label: "Applicants" },
  { href: "/admin", label: "Admin", minRole: "ADMIN" }
];

const roleRank: Record<AppRole, number> = { CLIENT: 1, OPS: 2, ADMIN: 3 };

export default function Sidebar({
  role,
  appName
}: {
  role: AppRole;
  appName: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandMark" />
        <div>
          <div className="brandName">{appName}</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{role}</div>
        </div>
      </div>

      <nav className="nav">
        {NAV.filter((i) => !i.minRole || roleRank[role] >= roleRank[i.minRole]).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} className={active ? "active" : ""}>
              {item.label}
            </Link>
          );
        })}
        <a href="/api/auth/logout" style={{ marginTop: 8 }}>
          Sign out
        </a>
      </nav>

      <div style={{ marginTop: 18, padding: "10px 10px" }} className="notice">
        <div style={{ fontWeight: 650, color: "var(--text)" }}>Phase 1</div>
        <div style={{ marginTop: 4 }}>
          Auth + schema + UI scaffold only. Data pages are placeholders.
        </div>
      </div>
    </aside>
  );
}
