export default function Topbar({
  title,
  subtitle,
  right
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="topbar">
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle ? <div className="sub">{subtitle}</div> : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{right}</div>
    </div>
  );
}
