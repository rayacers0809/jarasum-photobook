export default function NotFound() {
  return (
    <div className="wrap" style={{ padding: "120px 0", textAlign: "center" }}>
      <div className="kicker">404</div>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 56, fontWeight: 500, margin: "16px 0" }}>Page not found.</h1>
      <a className="btn" href={(process.env.NEXT_PUBLIC_BASE_PATH || "") + "/"}>← HOME</a>
    </div>
  );
}
