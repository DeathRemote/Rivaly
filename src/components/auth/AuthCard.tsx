"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { countries } from "@/lib/countries";

type Mode = "login" | "signup";

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AuthCard({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const title = useMemo(() => (mode === "login" ? "Login" : "Create account"), [mode]);

  async function onCredentialsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const username = String(form.get("username") || "").trim();
    const country = String(form.get("country") || "").trim().toUpperCase();

    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, username, country }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Failed to create account");
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl,
        redirect: false,
      });

      // next-auth v5's `signIn` typing can sometimes resolve to `never` depending on
      // provider typing/augmentation. Use a runtime-safe narrowing instead of
      // relying on TS inference here.
      if (result && typeof result === "object" && "error" in result && (result as any).error) {
        setError("Invalid email or password");
        return;
      }

      // Successful sign-in: navigate manually.
      const url =
        result && typeof result === "object" && "url" in result
          ? ((result as any).url as string | null | undefined)
          : undefined;
      router.push(url || callbackUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0px_24px_48px_rgba(0,0,0,0.4)] overflow-hidden">
      <div className="px-8 pt-10 pb-6 text-center">
        <div className="text-4xl font-black italic tracking-tighter text-[#f3ffca]">Rivaly</div>
        <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/60">
          Kinetic High-Stakes Minimalism
        </div>
      </div>

      <div className="px-8 pb-10">
        <div className="flex p-1 rounded-full bg-black/40 mb-7">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={cx(
              "flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-full transition",
              mode === "login" &&
                "bg-gradient-to-br from-[#f3ffca] to-[#beee00] text-[#3a4a00]",
              mode !== "login" && "text-white/60 hover:text-white",
            )}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={cx(
              "flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-full transition",
              mode === "signup" &&
                "bg-gradient-to-br from-[#f3ffca] to-[#beee00] text-[#3a4a00]",
              mode !== "signup" && "text-white/60 hover:text-white",
            )}
          >
            Sign up
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-[#ff7351]/30 bg-[#d53d18]/10 px-4 py-3 text-sm text-[#ffd2c8]">
            {error}
          </div>
        ) : null}

        <form onSubmit={onCredentialsSubmit} className="space-y-4">
          {mode === "signup" ? (
            <>
              <div className="space-y-1">
                <label className="px-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
                  Username
                </label>
                <input
                  name="username"
                  placeholder="e.g. aladin"
                  className="h-12 w-full rounded-xl bg-black/40 px-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#beee00]/25"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="px-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
                  Country
                </label>
                <select
                  name="country"
                  defaultValue=""
                  className="h-12 w-full rounded-xl bg-black/40 px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#beee00]/25"
                  required
                >
                  <option value="" disabled className="bg-black">
                    Select your country
                  </option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code} className="bg-black">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

          <div className="space-y-1">
            <label className="px-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
              Email
            </label>
            <input
              name="email"
              type="email"
              placeholder="name@rivaly.com"
              className="h-12 w-full rounded-xl bg-black/40 px-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#beee00]/25"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                Password
              </label>
              <a
                href="/forgot-password"
                className="text-[10px] font-bold uppercase tracking-widest text-[#f3ffca]/70 hover:text-[#f3ffca]"
              >
                Forgot?
              </a>
            </div>
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              className="h-12 w-full rounded-xl bg-black/40 px-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#beee00]/25"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={8}
            />
          </div>

          <button
            disabled={pending}
            className="mt-2 h-12 w-full rounded-xl bg-gradient-to-br from-[#f3ffca] to-[#beee00] text-[#3a4a00] text-xs font-black uppercase tracking-widest shadow-[0_8px_20px_-4px_rgba(202,253,0,0.3)] disabled:opacity-70"
          >
            {pending ? "Processing…" : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>

        <div className="my-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-white/10" />
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">
            Or continue with
          </div>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="h-12 w-full rounded-xl border border-white/10 bg-black/10 text-xs font-bold uppercase tracking-widest text-white/90 hover:bg-white/5"
        >
          Google
        </button>

        <div className="mt-8 text-center text-xs text-white/60">
          {mode === "login" ? (
            <span>
              Don’t have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="font-bold text-[#f3ffca] hover:underline"
              >
                Create one
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="font-bold text-[#f3ffca] hover:underline"
              >
                Login
              </button>
            </span>
          )}
        </div>
      </div>

      <div className="h-1.5 w-full bg-black/60">
        <div className="h-full w-2/3 bg-gradient-to-r from-[#f3ffca] to-[#beee00]" />
      </div>

      <div className="px-8 py-5 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">
        By continuing, you agree to Rivaly&apos;s terms.
      </div>
    </div>
  );
}
