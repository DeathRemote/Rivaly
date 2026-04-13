export const dynamic = "force-dynamic";

async function getBackendPing() {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!base) return { error: "NEXT_PUBLIC_BACKEND_URL is not set" } as const;

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/public/ping`, {
      cache: "no-store",
    });

    const text = await res.text();
    return {
      status: res.status,
      ok: res.ok,
      body: text,
    } as const;
  } catch (err: any) {
    return { error: err?.message ?? String(err) } as const;
  }
}

export default async function BackendTestPage() {
  const result = await getBackendPing();

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Backend Test</h1>
      <p>
        This page calls <code>/api/public/ping</code> on the configured backend.
      </p>
      <p>
        Backend URL env: <code>NEXT_PUBLIC_BACKEND_URL</code>
      </p>

      <pre
        style={{
          marginTop: 16,
          padding: 16,
          background: "#111",
          color: "#eee",
          borderRadius: 8,
          overflow: "auto",
        }}
      >
        {JSON.stringify(result, null, 2)}
      </pre>
    </main>
  );
}
