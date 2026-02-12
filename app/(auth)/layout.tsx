export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <div className="card" style={{ width: "100%", maxWidth: 420, overflow: "hidden" }}>
        {children}
      </div>
      <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 12 }}>
        Invite-only. Contact an Admin if you need access.
      </div>
    </div>
  );
}
