"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function ResetPasswordForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") || "");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to reset password");
      }

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-xl border border-[#ff7351]/30 bg-[#d53d18]/10 px-4 py-3 text-sm text-[#ffd2c8]">
        Missing reset token.
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
          Password updated. You can log in now.
        </div>
        <button
          onClick={() => signIn(undefined, { callbackUrl: "/login" })}
          className="h-12 w-full rounded-xl border border-white/10 bg-black/10 text-xs font-bold uppercase tracking-widest text-white/90 hover:bg-white/5"
        >
          Go to login
        </button>
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
          New password
        </label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="h-12 w-full rounded-xl bg-black/40 px-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#beee00]/25"
          placeholder="••••••••"
        />
      </div>

      <button
        disabled={pending}
        className="h-12 w-full rounded-xl bg-gradient-to-br from-[#f3ffca] to-[#beee00] text-[#3a4a00] text-xs font-black uppercase tracking-widest shadow-[0_8px_20px_-4px_rgba(202,253,0,0.3)] disabled:opacity-70"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
