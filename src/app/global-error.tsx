"use client";

import { useEffect } from "react";

/**
 * Global error boundary (M4.5) — the last resort when the root layout itself
 * fails, so it must render its own <html>/<body> and cannot assume the shell,
 * theme provider or fonts are present. Kept deliberately plain.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0b0b0f",
          color: "#e7e7ea",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Strike OS could not start</h1>
          <p style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
            The application hit a fatal error before it could render. Reloading is safe.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "10px 18px",
              borderRadius: 10,
              border: "1px solid #333",
              background: "#1a1a22",
              color: "#e7e7ea",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
