import { login } from "./actions";

export default function LoginPage({
  searchParams
}: {
  searchParams?: { error?: string };
}) {
  const error = searchParams?.error;

  return (
    <>
      <div className="topbar">
        <div>
          <div className="h1">Sign in</div>
          <div className="sub">Applicant Screening — Admin dashboard</div>
        </div>
        <span className="badge">MVP</span>
      </div>

      <div style={{ padding: 18 }}>
        {error ? <div className="notice bad" style={{ marginBottom: 12 }}>{error}</div> : null}

        <form action={login} className="grid" style={{ gap: 10 }}>
          <label>
            <div style={{ marginBottom: 6, color: "var(--muted)", fontSize: 13 }}>Email</div>
            <input className="input" name="email" type="email" placeholder="name@company.com" required />
          </label>

          <label>
            <div style={{ marginBottom: 6, color: "var(--muted)", fontSize: 13 }}>Password</div>
            <input className="input" name="password" type="password" placeholder="••••••••" required />
          </label>

          <button className="btn primary" type="submit" style={{ width: "100%", marginTop: 6 }}>
            Sign in
          </button>
        </form>

        <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 13 }}>
          No self‑signup in MVP. An Admin must create your account.
        </div>
      </div>
    </>
  );
}
