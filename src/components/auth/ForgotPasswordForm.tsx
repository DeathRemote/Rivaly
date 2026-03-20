"use client";

import { useState } from "react";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to request reset");
      }

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
        If an account exists for that email, a reset link has been sent.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-[#ff7351]/30 bg-[#d53d18]/10 px-4 py-3 text-sm text-[#ffd2c8]">
          {error}
        </div>
      ) : null}

      <div className="space-y-1">
        <label className="px-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
          Email
        </label>
        <input
          name="email"
          type="email"
          required
          className="h-12 w-full rounded-xl bg-black/40 px-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#beee00]/25"
          placeholder="name@rivaly.com"
        />
      </div>

      <button
        disabled={pending}
        className="h-12 w-full rounded-xl bg-gradient-to-br from-[#f3ffca] to-[#beee00] text-[#3a4a00] text-xs font-black uppercase tracking-widest shadow-[0_8px_20px_-4px_rgba(202,253,0,0.3)] disabled:opacity-70"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
