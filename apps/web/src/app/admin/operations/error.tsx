"use client";

import Link from "next/link";

export default function OperationsError({ reset }: { reset: () => void }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#faf6f0", color: "#3c342d" }}>
      <section style={{ width: "min(100%, 520px)", padding: 32, border: "1px solid #e6dacd", borderRadius: 16, background: "#fff" }}>
        <p style={{ margin: 0, color: "#8b6d43", fontSize: 12, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" }}>Operations temporarily unavailable</p>
        <h1 style={{ margin: "12px 0", fontFamily: "Georgia, serif", fontSize: 32 }}>This page couldn’t load.</h1>
        <p style={{ lineHeight: 1.6 }}>Your booking records were not changed. Please try loading Operations again.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
          <button type="button" onClick={reset} style={{ padding: "12px 18px", border: 0, borderRadius: 9, background: "#3c342d", color: "#fff", font: "inherit", cursor: "pointer" }}>Try again</button>
          <Link href="/admin" style={{ padding: "12px 18px", border: "1px solid #d9c9b8", borderRadius: 9, color: "inherit", textDecoration: "none" }}>Return to overview</Link>
        </div>
      </section>
    </main>
  );
}
